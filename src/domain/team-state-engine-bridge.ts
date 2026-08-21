import type { CombatContext } from "./combat-context";
import type {
  ActiveEffectInstance,
  EffectDefinition,
  EffectTargetScope,
  TriggerDefinition,
} from "./effect-models";
import type { FinalStats, UserBuild } from "./models";
import {
  advanceState,
  processEvent,
  type ActiveRuntimeEffect,
  type ActorState,
  type CombatEvent,
  type CombatState,
  type StateDiagnostic,
  type StateTransition,
} from "./state-engine";
import type { TeamState } from "./team-engine";

export interface TeamStructuredTriggerInput {
  state: TeamState;
  event: CombatEvent;
  ownerActorId: string;
  sourceDefinition: EffectDefinition;
  ownerDefinitions: readonly EffectDefinition[];
  trigger: TriggerDefinition;
  sequence: UserBuild["sequence"];
  panelStats: FinalStats;
  resonanceMode?: string;
  element?: CombatContext["element"];
  incomingActorId?: string;
}

export interface TeamStructuredTriggerResult {
  state: TeamState;
  emittedEvents: readonly CombatEvent[];
  transitions: readonly StateTransition[];
  diagnostics: readonly StateDiagnostic[];
}

export interface TeamRuntimeAdvanceResult {
  state: TeamState;
  transitions: readonly StateTransition[];
  diagnostics: readonly StateDiagnostic[];
}

type TeamStateWithCounters = TeamState & {
  triggerCounters?: Record<string, number>;
};

type TeamRuntimeEffect = ActiveEffectInstance &
  Partial<
    Pick<
      ActiveRuntimeEffect,
      "activatedAt" | "expiresAt" | "stackExpirations" | "extensionCount"
    >
  >;

function recipients(
  scope: EffectTargetScope,
  ownerId: string,
  state: TeamState,
  context: { incomingActorId?: string; targetId?: string },
): readonly string[] {
  const actorIds = Object.keys(state.actorsById);
  switch (scope) {
    case "self":
      return [ownerId];
    case "team":
      return actorIds;
    case "other-team-members":
      return actorIds.filter((actorId) => actorId !== ownerId);
    case "incoming-resonator":
      return context.incomingActorId ? [context.incomingActorId] : [];
    case "active-resonator":
      return [state.activeActorId];
    case "enemy":
      return context.targetId
        ? [context.targetId]
        : Object.keys(state.targetsById);
  }
}

function toCombatState(state: TeamState): CombatState {
  const actors = Object.fromEntries(
    Object.entries(state.actorsById).map(([actorId, actor]) => [
      actorId,
      {
        onField: state.activeActorId === actorId,
        form: actor.currentForm,
        namedStates: actor.states,
        resources: Object.fromEntries(
          Object.entries(actor.resources).map(([resourceId, resource]) => [
            resourceId,
            { current: resource.current, max: resource.max },
          ]),
        ),
      } satisfies ActorState,
    ]),
  );

  const activeEffects: ActiveRuntimeEffect[] = state.activeEffects.map(
    (effect) => {
      const runtime = effect as TeamRuntimeEffect;
      return {
        ...effect,
        activatedAt:
          runtime.activatedAt ??
          effect.startTimeSeconds ??
          state.currentTimeSeconds,
        expiresAt: runtime.expiresAt ?? effect.endTimeSeconds,
        stackExpirations: runtime.stackExpirations,
        extensionCount: runtime.extensionCount,
      };
    },
  );

  return {
    time: state.currentTimeSeconds,
    actors,
    targets: state.targetsById,
    activeEffects,
    cooldowns: state.cooldowns,
    triggerCounters: (state as TeamStateWithCounters).triggerCounters ?? {},
    registries: {},
  };
}

function projectCombatState(
  team: TeamState,
  combat: CombatState,
  context: { incomingActorId?: string; targetId?: string } = {},
): TeamState {
  const actorsById = Object.fromEntries(
    Object.entries(team.actorsById).map(([actorId, actor]) => {
      const combatActor = combat.actors[actorId];
      if (!combatActor) return [actorId, actor];
      const resources = Object.fromEntries(
        Object.entries(actor.resources).map(([resourceId, resource]) => {
          const next = combatActor.resources[resourceId];
          return [
            resourceId,
            next
              ? { ...resource, current: next.current, max: next.max }
              : resource,
          ];
        }),
      );
      return [
        actorId,
        {
          ...actor,
          resources,
          currentForm: combatActor.form,
          states: [...combatActor.namedStates],
        },
      ];
    }),
  );

  const projected = {
    ...team,
    currentTimeSeconds: combat.time,
    actorsById,
    targetsById: combat.targets,
    cooldowns: { ...combat.cooldowns },
    activeEffects: [] as ActiveEffectInstance[],
    triggerCounters: { ...combat.triggerCounters },
  } as TeamStateWithCounters;

  projected.activeEffects = combat.activeEffects.map((effect) => ({
    ...effect,
    startTimeSeconds: effect.activatedAt,
    endTimeSeconds: effect.expiresAt,
    affectedEntityIds:
      effect.affectedEntityIds?.length
        ? effect.affectedEntityIds
        : recipients(effect.definition.target, effect.ownerId, projected, context),
  }));

  return projected;
}

function materializeTrigger(
  trigger: TriggerDefinition,
  sequence: UserBuild["sequence"],
): TriggerDefinition {
  const exactCooldown = trigger.cooldownSecondsBySequence?.[sequence];
  return {
    ...trigger,
    operationOwner: undefined,
    cooldown:
      exactCooldown === undefined
        ? trigger.cooldown
        : trigger.cooldown
          ? { ...trigger.cooldown, seconds: exactCooldown }
          : { seconds: exactCooldown, scope: "target" },
  };
}

function singleTriggerDefinitions(
  definitions: readonly EffectDefinition[],
  sourceDefinition: EffectDefinition,
  trigger: TriggerDefinition,
  sequence: UserBuild["sequence"],
): readonly EffectDefinition[] {
  const stripped = definitions.map((definition) => ({
    ...definition,
    triggers: [] as const,
  }));
  const syntheticSource: EffectDefinition = {
    ...sourceDefinition,
    triggers: [materializeTrigger(trigger, sequence)],
  };
  const sourceIndex = stripped.findIndex(
    (definition) => definition.id === sourceDefinition.id,
  );
  if (sourceIndex < 0) return [...stripped, syntheticSource];
  return stripped.map((definition, index) =>
    index === sourceIndex ? syntheticSource : definition,
  );
}

/**
 * Executes one complete data-owned TriggerDefinition through the canonical
 * State Engine. Team binding supplies the actor-instance owner, so operations
 * never fall back to a static resonator/weapon/sonata source id.
 */
export function applyTeamStructuredTrigger(
  input: TeamStructuredTriggerInput,
): TeamStructuredTriggerResult {
  const event: CombatEvent = {
    ...input.event,
    ownerId: input.ownerActorId,
  };
  const definitions = singleTriggerDefinitions(
    input.ownerDefinitions,
    input.sourceDefinition,
    input.trigger,
    input.sequence,
  );
  const result = processEvent(
    toCombatState(input.state),
    event,
    definitions,
    {
      panelStats: input.panelStats,
      resonanceMode: input.resonanceMode,
      element: input.element,
    },
    {
      statusStorageKey: (statusId, ownerId) => `${statusId}::${ownerId}`,
    },
  );
  return {
    state: projectCombatState(input.state, result.state, {
      incomingActorId: input.incomingActorId,
      targetId: event.targetId,
    }),
    emittedEvents: result.emittedEvents,
    transitions: result.transitions,
    diagnostics: result.diagnostics,
  };
}

/** Uses the same expiry semantics as Personal DPS, including independent stacks. */
export function advanceTeamRuntime(
  state: TeamState,
  timestamp: number,
): TeamRuntimeAdvanceResult {
  const result = advanceState(toCombatState(state), timestamp);
  return {
    state: projectCombatState(state, result.state),
    transitions: result.transitions,
    diagnostics: result.diagnostics,
  };
}
