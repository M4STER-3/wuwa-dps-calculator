import {
  calculateActionOutcomes,
  type HealingResult,
  type ShieldResult,
} from "./action-outcome-engine";
import { resolveActionResourceTransaction } from "./action-resource-transactions";
import {
  calculateActionDamage,
  type DamageAmounts,
  type DamageResult,
  type DamageTarget,
} from "./damage-engine";
import type { EffectAuditEntry } from "./effect-engine";
import type {
  ActiveEffectInstance,
  EffectDefinition,
  EffectTargetScope,
  StatusDefinition,
} from "./effect-models";
import type {
  CombatAction,
  CombatResource,
  FinalStats,
  MainEcho,
  Resonator,
  Sonata,
  UserBuild,
  Weapon,
} from "./models";
import { initialRuntimeStates } from "./runtime-initial-states";
import type {
  ActiveStatus,
  CombatEvent,
  StateTransition,
  TargetState,
} from "./state-engine";
import type { CoordinatedResponseDefinition } from "./coordinated-response-engine";
import {
  bindTeamActorRuntime,
  discoverTeamIntroActions,
  resolveTeamActorAction,
  type BoundCoordinatedResponse,
  type BoundTeamActorRuntime,
} from "./team-runtime-binding";
import {
  countActionHits,
  resolveActionHitSchedule,
  sliceActionToHit,
} from "./team-hit-timeline";
import { evaluatePredicate, type CombatContext } from "./combat-context";
import {
  resolveUniversalActionPipeline,
  resolveUniversalActionReplacement,
} from "./universal-action-pipeline";
import type { RuntimeBaseStatBasis } from "./combat-context";

export const TEAM_SIZE_LIMIT = 3;
export const SWITCH_BACK_COOLDOWN_SECONDS = 1;

export type TeamDiagnosticCode =
  | "unknown-team-actor"
  | "duplicate-actor-id"
  | "invalid-team-size"
  | "inactive-actor-action"
  | "invalid-switch-target"
  | "switch-cooldown"
  | "missing-scaling-owner"
  | "missing-damage-owner"
  | "timing-required"
  | "missing-exact-talent-data"
  | "team-context-unsupported"
  | "team-energy-propagation-required"
  | "unknown-action"
  | "invalid-wait"
  | "unbound-runtime-owner"
  | "action-resource-rejected"
  | "action-cooldown"
  | "requirement-context-required"
  | "modifier-context-required"
  | "hit-timing-required"
  | "hit-count-mismatch";

export interface TeamDiagnostic {
  code: TeamDiagnosticCode;
  message: string;
  stepIndex?: number;
  eventId?: string;
}

export interface TeamResourceState {
  current: number;
  max: number;
  semantic: NonNullable<CombatResource["semantic"]>;
}

export interface TeamActorState {
  actorId: string;
  resonatorId: string;
  resonator: Resonator;
  build: UserBuild;
  finalStats: FinalStats;
  sequence: UserBuild["sequence"];
  talentLevels: UserBuild["skillLevels"];
  resources: Record<string, TeamResourceState>;
  forms: readonly string[];
  currentForm?: string;
  resonanceMode?: string;
  states: readonly string[];
  switchReadyAtSeconds: number;
  baseStatBasis?: RuntimeBaseStatBasis;
  actions: Readonly<Record<string, CombatAction>>;
  effects: readonly EffectDefinition[];
  runtime: BoundTeamActorRuntime;
  coordinatedResponses: readonly BoundCoordinatedResponse[];
  switchReadiness?: readonly TeamSwitchReadinessRule[];
}

export type TeamSwitchReadinessRule =
  | { kind: "full-resource"; semantic: "concerto-energy" }
  | { kind: "state-token"; stateId: string; consumeOnUse?: boolean };

export type TeamDamageAttribution =
  | "direct"
  | "echo"
  | "follow-up"
  | "coordinated"
  | "summon"
  | "status"
  | "tune";

export interface TeamEmittedAction {
  actorId: string;
  actionId: string;
  targetId: string;
  damageOwnerId?: string;
  scalingOwnerId?: string;
  triggeringActorId?: string;
  delaySeconds?: number;
  attribution?: TeamDamageAttribution;
}

export interface TeamQueuedEvent {
  event: CombatEvent;
  execute?: TeamEmittedAction;
  hitIndex?: number;
}

export interface TeamState {
  activeActorId: string;
  actorsById: Record<string, TeamActorState>;
  currentTimeSeconds: number;
  targetsById: Record<string, TargetState>;
  activeEffects: ActiveEffectInstance[];
  cooldowns: Record<string, number>;
  eventQueue: TeamQueuedEvent[];
  queuedEventSerial: number;
  diagnostics: TeamDiagnostic[];
  coverage: { supported: number; unsupported: number };
}

export interface TeamActorInput {
  actorId: string;
  resonator: Resonator;
  build: UserBuild;
  initialResources?: Readonly<Record<string, number>>;
  actions?: readonly CombatAction[];
  effects?: readonly EffectDefinition[];
  weapon?: Weapon;
  sonata?: Sonata;
  mainEcho?: MainEcho;
  coordinatedResponses?: readonly CoordinatedResponseDefinition[];
  switchReadiness?: readonly TeamSwitchReadinessRule[];
  initialForm?: string;
  resonanceMode?: string;
  baseStatBasis?: RuntimeBaseStatBasis;
}

export interface TeamSimulationInput {
  actors: readonly TeamActorInput[];
  activeActorId: string;
  targetIds?: readonly string[];
  target: DamageTarget;
  steps?: readonly TeamRotationStep[];
  /** Exact externally/data-emitted work may begin off field on the same shared queue. */
  scheduledActions?: readonly TeamEmittedAction[];
  externalEvents?: readonly CombatEvent[];
  initialEffects?: readonly ActiveEffectInstance[];
  initialTargetsById?: Readonly<Record<string, TargetState>>;
  initialState?: TeamState;
}

export type TeamRotationStep =
  | {
      kind: "action";
      actorId: string;
      actionId: string;
      targetId?: string;
      durationOverrideSeconds?: number;
    }
  | { kind: "switch"; toActorId: string }
  | { kind: "wait"; seconds: number };

export interface TeamDamageEvent {
  timestamp: number;
  eventId: string;
  actionId: string;
  sourceEntityId: string;
  triggeringActorId: string;
  damageOwnerId: string;
  scalingOwnerId: string;
  targetId: string;
  scalingStats: FinalStats;
  effectAudit: readonly EffectAuditEntry[];
  damage: DamageResult;
}

export interface TeamHealingEvent {
  timestamp: number;
  eventId: string;
  sourceEntityId: string;
  outcomeOwnerId: string;
  scalingOwnerId: string;
  recipientActorIds: readonly string[];
  result: HealingResult;
}

export interface TeamShieldEvent {
  timestamp: number;
  eventId: string;
  sourceEntityId: string;
  outcomeOwnerId: string;
  scalingOwnerId: string;
  recipientActorIds: readonly string[];
  result: ShieldResult;
}

export interface TeamSimulationResult {
  currentTimeSeconds: number;
  resolvedDurationSeconds?: number;
  activeActorId: string;
  actorsById: Readonly<Record<string, TeamActorState>>;
  targetsById: Readonly<Record<string, TargetState>>;
  activeEffects: readonly ActiveEffectInstance[];
  eventLog: readonly CombatEvent[];
  damageEvents: readonly TeamDamageEvent[];
  healingEvents: readonly TeamHealingEvent[];
  shieldEvents: readonly TeamShieldEvent[];
  stateTransitions: readonly StateTransition[];
  diagnostics: readonly TeamDiagnostic[];
  coverage: { supported: number; unsupported: number };
  partial: boolean;
  totalResolvedDamage: DamageAmounts;
  damageByActorId: Readonly<Record<string, DamageAmounts>>;
  finalState: TeamState;
}

const zero = (): DamageAmounts => ({ nonCrit: 0, crit: 0, expected: 0 });
const add = (a: DamageAmounts, b: DamageAmounts): DamageAmounts => ({
  nonCrit: a.nonCrit + b.nonCrit,
  crit: a.crit + b.crit,
  expected: a.expected + b.expected,
});
const emptyTarget = (): TargetState => ({ statuses: {}, marks: {} });

function semantic(
  resource: CombatResource,
): NonNullable<CombatResource["semantic"]> {
  return resource.semantic ?? "character-resource";
}

function teamCombatContext(
  state: TeamState,
  input: {
    actorId: string;
    ownerId: string;
    targetId: string;
    panelStats: FinalStats;
    actionId?: string;
    damageType?: CombatContext["damageType"];
    sourceId?: string;
    sourceEntityId?: string;
    triggeringActorId?: string;
    damageOwnerId?: string;
    scalingOwnerId?: string;
    event?: CombatEvent;
  },
): CombatContext {
  const actor = state.actorsById[input.actorId];
  const owner = state.actorsById[input.ownerId];
  const target = state.targetsById[input.targetId] ?? emptyTarget();
  const ownedEffects = state.activeEffects.filter(
    (effect) => effect.ownerId === input.ownerId,
  );
  return {
    timestamp: state.currentTimeSeconds,
    actorId: input.actorId,
    ownerId: input.ownerId,
    targetId: input.targetId,
    sourceId: input.sourceId,
    sourceEntityId: input.sourceEntityId,
    triggeringActorId: input.triggeringActorId,
    damageOwnerId: input.damageOwnerId,
    scalingOwnerId: input.scalingOwnerId,
    actionId: input.actionId,
    damageType: input.damageType,
    element: actor?.resonator.element,
    resonanceMode: actor?.resonanceMode,
    eventKind: input.event?.kind,
    eventSourceId: input.event?.sourceId,
    eventTargetId: input.event?.targetId ?? input.targetId,
    panelStats: input.panelStats,
    resources: owner?.resources,
    states: actor?.states,
    form: actor?.currentForm,
    onField: actor ? state.activeActorId === actor.actorId : undefined,
    targetHpRatio:
      target.hp !== undefined && target.maxHp
        ? target.hp / target.maxHp
        : undefined,
    targetStatuses: Object.fromEntries(
      Object.values(target.statuses).map((status) => [
        status.definition.id,
        status.stacks,
      ]),
    ),
    activeEffectIds: ownedEffects.map((effect) => effect.definition.id),
    activeEffectStacks: Object.fromEntries(
      ownedEffects.map((effect) => [
        effect.definition.id,
        effect.stacks ?? 1,
      ]),
    ),
  };
}

export function createTeamState(
  input: Omit<TeamSimulationInput, "steps">,
): TeamState {
  const diagnostics: TeamDiagnostic[] = [];
  const actorsById: Record<string, TeamActorState> = {};
  if (input.actors.length < 1 || input.actors.length > TEAM_SIZE_LIMIT) {
    diagnostics.push({
      code: "invalid-team-size",
      message: "A team requires one to three actor instances.",
    });
  }

  for (const actor of input.actors) {
    if (actorsById[actor.actorId]) {
      diagnostics.push({
        code: "duplicate-actor-id",
        message: `Actor instance id ${actor.actorId} is duplicated.`,
      });
      continue;
    }
    const runtime = bindTeamActorRuntime(actor);
    const resources = Object.fromEntries(
      runtime.resources.map((resource) => [
        resource.id,
        {
          current: Math.min(
            resource.cap,
            Math.max(0, actor.initialResources?.[resource.id] ?? 0),
          ),
          max: resource.cap,
          semantic: semantic(resource),
        },
      ]),
    );
    const effects = runtime.effects.map((effect) => effect.definition);
    actorsById[actor.actorId] = {
      actorId: actor.actorId,
      resonatorId: actor.resonator.id,
      resonator: actor.resonator,
      build: actor.build,
      finalStats: {
        ...actor.build.finalStats,
        elementalDamageBonus: { ...actor.build.finalStats.elementalDamageBonus },
        damageTypeBonus: { ...actor.build.finalStats.damageTypeBonus },
      },
      sequence: actor.build.sequence,
      talentLevels: { ...actor.build.skillLevels },
      resources,
      forms: [...(actor.resonator.combat?.forms ?? [])],
      currentForm: actor.initialForm ?? actor.resonator.combat?.defaultForm,
      resonanceMode: actor.resonanceMode,
      states: initialRuntimeStates(actor.build.sequence),
      switchReadyAtSeconds: 0,
      baseStatBasis: actor.baseStatBasis,
      actions: runtime.actionsById,
      effects,
      runtime,
      coordinatedResponses: runtime.coordinatedResponses,
      switchReadiness: actor.switchReadiness,
    };
  }

  if (!actorsById[input.activeActorId]) {
    diagnostics.push({
      code: "unknown-team-actor",
      message: `Active actor ${input.activeActorId} is not in the team.`,
    });
  }

  const actorIds = Object.keys(actorsById);
  const targetIds = input.targetIds ?? ["target"];
  const initiallyActive = Object.values(actorsById).flatMap((actor) =>
    actor.effects
      .filter(
        (effect) =>
          effect.activationPolicy === "initially-active" &&
          effect.rules.some((rule) => rule.accounting === "runtime"),
      )
      .map((effect) => ({
        id: `initial:${actor.actorId}:${effect.id}`,
        definition: effect,
        ownerId: actor.actorId,
        affectedEntityIds: resolveInitialRecipients(
          effect.target,
          actor.actorId,
          actorIds,
          input.activeActorId,
          targetIds,
        ),
        stacks: effect.lifecycle?.stacks?.initial ?? 0,
        startTimeSeconds: 0,
        endTimeSeconds:
          effect.lifecycle?.duration.kind === "fixed"
            ? effect.lifecycle.duration.seconds
            : undefined,
      })),
  );

  return {
    activeActorId: input.activeActorId,
    actorsById,
    currentTimeSeconds: 0,
    targetsById: input.initialTargetsById
      ? structuredClone(input.initialTargetsById)
      : Object.fromEntries(targetIds.map((id) => [id, emptyTarget()])),
    activeEffects: [...initiallyActive, ...(input.initialEffects ?? [])],
    cooldowns: {},
    eventQueue: [],
    queuedEventSerial: 0,
    diagnostics,
    coverage: { supported: 0, unsupported: diagnostics.length },
  };
}

function resolveInitialRecipients(
  scope: EffectTargetScope,
  owner: string,
  actors: readonly string[],
  active: string,
  targets: readonly string[],
): readonly string[] {
  if (scope === "self") return [owner];
  if (scope === "team") return actors;
  if (scope === "other-team-members") {
    return actors.filter((id) => id !== owner);
  }
  if (scope === "active-resonator") return [active];
  if (scope === "enemy") return targets;
  return [];
}

export function resolveTeamRecipients(
  scope: EffectTargetScope,
  sourceActorId: string,
  state: TeamState,
  context: { incomingActorId?: string; targetId?: string } = {},
): readonly string[] {
  const ids = Object.keys(state.actorsById);
  switch (scope) {
    case "self":
      return [sourceActorId];
    case "team":
      return ids;
    case "other-team-members":
      return ids.filter((id) => id !== sourceActorId);
    case "incoming-resonator":
      return context.incomingActorId ? [context.incomingActorId] : [];
    case "active-resonator":
      return [state.activeActorId];
    case "enemy":
      return context.targetId ? [context.targetId] : Object.keys(state.targetsById);
  }
}

export function activateTeamEffect(
  state: TeamState,
  definition: EffectDefinition,
  ownerId: string,
  context: { incomingActorId?: string; targetId?: string } = {},
): void {
  const affectedEntityIds = resolveTeamRecipients(
    definition.target,
    ownerId,
    state,
    context,
  );
  const life = definition.lifecycle;
  const existing = state.activeEffects.find(
    (effect) =>
      effect.ownerId === ownerId && effect.definition.id === definition.id,
  );
  const endTimeSeconds =
    life?.duration.kind === "fixed"
      ? state.currentTimeSeconds + life.duration.seconds
      : undefined;

  if (
    existing &&
    (life?.uniqueness === "refresh-existing" ||
      life?.refresh === "reset-duration")
  ) {
    state.activeEffects = state.activeEffects.map((effect) =>
      effect === existing
        ? {
            ...effect,
            affectedEntityIds,
            startTimeSeconds: state.currentTimeSeconds,
            endTimeSeconds,
          }
        : effect,
    );
    return;
  }
  if (existing && life?.uniqueness === "reject-duplicate") return;
  if (existing && life?.uniqueness === "replace-existing") {
    state.activeEffects = state.activeEffects.filter(
      (effect) => effect !== existing,
    );
  }
  state.activeEffects.push({
    id: `${definition.id}:${ownerId}:${state.currentTimeSeconds}`,
    definition,
    ownerId,
    affectedEntityIds,
    stacks: life?.stacks?.initial ?? 0,
    startTimeSeconds: state.currentTimeSeconds,
    endTimeSeconds,
  });
}

function pushStateDiagnostic(
  state: TeamState,
  code: TeamDiagnosticCode,
  message: string,
  eventId?: string,
): void {
  state.diagnostics.push({ code, message, eventId });
  state.coverage.unsupported += 1;
}

function hasHitDependentTeamSemantics(
  state: TeamState,
  action: CombatAction,
): boolean {
  const hitCount = countActionHits(action);
  const effects = Object.values(state.actorsById).flatMap(
    (actor) => actor.runtime.effects,
  );
  if (
    effects.some((bound) =>
      bound.definition.triggers?.some((trigger) => trigger.event === "action-hit"),
    )
  ) {
    return true;
  }
  if (hitCount <= 1) return false;
  return (
    effects.some((bound) =>
      bound.definition.triggers?.some(
        (trigger) => trigger.event === "damage-dealt",
      ),
    ) ||
    Object.values(state.actorsById).some(
      (actor) => actor.coordinatedResponses.length > 0,
    )
  );
}

function enqueueTeamEvent(state: TeamState, queued: TeamQueuedEvent): void {
  state.eventQueue.push(queued);
  state.eventQueue.sort(
    (left, right) =>
      left.event.timestamp - right.event.timestamp ||
      left.event.id.localeCompare(right.event.id),
  );
}

/**
 * Schedules an emitted action on the shared global timeline. Exact hit timings
 * produce one queued action-hit per real hit. Missing timings never fabricate a
 * hit event; aggregate damage is kept as a provisional custom queue event.
 */
export function scheduleTeamAction(
  state: TeamState,
  action: TeamEmittedAction,
): void {
  const source = state.actorsById[action.actorId];
  if (!source) {
    pushStateDiagnostic(
      state,
      "unbound-runtime-owner",
      `Action owner ${action.actorId} is not bound.`,
    );
    return;
  }
  const resolution = resolveTeamActorAction(
    source.runtime,
    source.build,
    action.actionId,
  );
  if (resolution.status === "unsupported") {
    pushStateDiagnostic(state, resolution.code, resolution.message);
    return;
  }

  const baseTime = state.currentTimeSeconds + (action.delaySeconds ?? 0);
  const schedule = resolveActionHitSchedule(resolution.action);
  const attribution = action.attribution ?? "coordinated";
  const payload = {
    damageOwnerId: action.damageOwnerId,
    scalingOwnerId: action.scalingOwnerId,
    attribution,
  };

  if (schedule.status === "supported") {
    for (const hit of schedule.hits) {
      const serial = state.queuedEventSerial++;
      const event: CombatEvent = {
        id: `team-queued-hit:${serial}:${action.actorId}:${action.actionId}:${hit.hitIndex}`,
        timestamp: baseTime + hit.offsetSeconds,
        kind: "action-hit",
        ownerId: action.actorId,
        actorId: action.actorId,
        triggeringActorId: action.triggeringActorId,
        targetId: action.targetId,
        actionId: action.actionId,
        hitIndex: hit.hitIndex,
        payload,
      };
      enqueueTeamEvent(state, { event, execute: action, hitIndex: hit.hitIndex });
    }
    return;
  }

  if (schedule.status === "unsupported") {
    pushStateDiagnostic(
      state,
      schedule.code === "hit-count-mismatch"
        ? "hit-count-mismatch"
        : "hit-timing-required",
      schedule.message,
    );
  } else if (hasHitDependentTeamSemantics(state, resolution.action)) {
    pushStateDiagnostic(state, "hit-timing-required", schedule.message);
  }

  const serial = state.queuedEventSerial++;
  enqueueTeamEvent(state, {
    event: {
      id: `team-queued-aggregate:${serial}:${action.actorId}:${action.actionId}`,
      timestamp: baseTime,
      kind: "custom",
      ownerId: action.actorId,
      actorId: action.actorId,
      triggeringActorId: action.triggeringActorId,
      targetId: action.targetId,
      actionId: action.actionId,
      payload: { ...payload, aggregateDamage: true },
    },
    execute: action,
  });
}

export function simulateTeam(input: TeamSimulationInput): TeamSimulationResult {
  const state = input.initialState
    ? cloneTeamState(input.initialState)
    : createTeamState(input);
  const startTimeSeconds = state.currentTimeSeconds;
  const eventLog: CombatEvent[] = [];
  const damageEvents: TeamDamageEvent[] = [];
  const healingEvents: TeamHealingEvent[] = [];
  const shieldEvents: TeamShieldEvent[] = [];
  const stateTransitions: StateTransition[] = [];
  let serial = 0;
  let timingComplete = true;

  const diagnostic = (
    code: TeamDiagnosticCode,
    message: string,
    stepIndex?: number,
    eventId?: string,
  ) => {
    state.diagnostics.push({ code, message, stepIndex, eventId });
    state.coverage.unsupported += 1;
  };

  const emit = (
    kind: CombatEvent["kind"],
    ownerId: string,
    actorId: string,
    targetId = "target",
    payload?: Record<string, unknown>,
    actionId?: string,
  ): CombatEvent => {
    const event: CombatEvent = {
      id: `team:${serial++}`,
      timestamp: state.currentTimeSeconds,
      kind,
      ownerId,
      actorId,
      targetId,
      actionId,
      payload,
    };
    eventLog.push(event);
    return event;
  };

  const damage = (
    emitted: TeamEmittedAction,
    event: CombatEvent,
    hitIndex?: number,
  ): boolean => {
    const eventId = event.id;
    const owner = state.actorsById[emitted.damageOwnerId ?? ""];
    if (!emitted.damageOwnerId || !owner) {
      diagnostic(
        "missing-damage-owner",
        `Damage owner ${emitted.damageOwnerId ?? "(missing)"} is not a team actor.`,
        undefined,
        eventId,
      );
      return false;
    }
    const scaler = state.actorsById[emitted.scalingOwnerId ?? ""];
    if (!emitted.scalingOwnerId || !scaler) {
      diagnostic(
        "missing-scaling-owner",
        `Scaling owner ${emitted.scalingOwnerId ?? "(missing)"} is not a team actor.`,
        undefined,
        eventId,
      );
      return false;
    }
    const source = state.actorsById[emitted.actorId];
    if (!source) {
      diagnostic(
        "unbound-runtime-owner",
        `Action owner ${emitted.actorId} is not bound.`,
        undefined,
        eventId,
      );
      return false;
    }
    const resolvedAction = resolveTeamActorAction(
      source.runtime,
      source.build,
      emitted.actionId,
    );
    if (resolvedAction.status === "unsupported") {
      diagnostic(
        resolvedAction.code,
        resolvedAction.message,
        undefined,
        eventId,
      );
      return false;
    }

    const action = resolvedAction.action;
    const target = state.targetsById[emitted.targetId] ?? emptyTarget();
    const context = teamCombatContext(state, {
      actorId: source.actorId,
      ownerId: owner.actorId,
      targetId: emitted.targetId,
      panelStats: scaler.finalStats,
      sourceEntityId: resolvedAction.sourceEntityId,
      triggeringActorId: emitted.triggeringActorId,
      damageOwnerId: owner.actorId,
      scalingOwnerId: scaler.actorId,
      actionId: action.id,
      damageType:
        action.damageType === "tuneRupture" ? undefined : action.damageType,
      event,
    });
    const statusEffects = Object.values(target.statuses)
      .filter((status) => status.definition.modifiers?.length)
      .map((status) => ({
        id: `status:${emitted.targetId}:${status.sourceOwnerId}:${status.definition.id}`,
        definition: {
          id: `status:${status.definition.id}`,
          label: status.definition.label,
          source: {
            id: status.sourceOwnerId,
            type: "system" as const,
            label: status.definition.label,
          },
          target: "enemy" as const,
          activationPolicy: "triggered" as const,
          rules: [
            {
              id: `status-rule:${status.definition.id}`,
              label: status.definition.label,
              accounting: "runtime" as const,
              modifiers: status.definition.modifiers!,
            },
          ],
        },
        ownerId: status.sourceOwnerId,
        sourceId: status.definition.id,
        affectedEntityIds: [emitted.targetId],
        stacks: status.stacks,
      }));
    const active = [...state.activeEffects, ...statusEffects];
    const pipeline = resolveUniversalActionPipeline({
      action,
      actionsById: source.actions,
      effects: active,
      context,
      finalStats: scaler.finalStats,
      baseStatBasis: scaler.baseStatBasis,
      sequence: scaler.sequence,
      teamMemberIds: Object.keys(state.actorsById),
    });
    if (pipeline.status === "unsupported") {
      diagnostic(
        pipeline.code as TeamDiagnosticCode,
        pipeline.message,
        undefined,
        eventId,
      );
      return false;
    }

    let damageAction = pipeline.action;
    if (hitIndex !== undefined) {
      const slice = sliceActionToHit(pipeline.action, hitIndex);
      if (slice.status === "unsupported") {
        diagnostic(slice.code, slice.message, undefined, eventId);
        return false;
      }
      damageAction = slice.action;
    }

    const result = calculateActionDamage({
      action: damageAction,
      finalStats: pipeline.finalStats,
      attackerLevel: scaler.build.characterLevel,
      scalingAttribute: pipeline.action.scalingAttribute ?? "attack",
      element: source.resonator.element,
      target: input.target,
      effectiveDamageType: pipeline.damageType,
      modifiers: pipeline.effects.damageModifiers,
    });
    if (result.status === "supported") {
      damageEvents.push({
        timestamp: state.currentTimeSeconds,
        eventId,
        actionId: pipeline.action.id,
        sourceEntityId: resolvedAction.sourceEntityId,
        triggeringActorId: emitted.triggeringActorId ?? emitted.actorId,
        damageOwnerId: owner.actorId,
        scalingOwnerId: scaler.actorId,
        targetId: emitted.targetId,
        scalingStats: pipeline.finalStats,
        effectAudit: pipeline.effects.audit,
        damage: result,
      });
      state.coverage.supported += 1;
      return true;
    }
    return false;
  };

  const recordActionOutcomes = (
    emitted: TeamEmittedAction,
    event: CombatEvent,
  ): void => {
    const owner = state.actorsById[emitted.damageOwnerId ?? ""];
    const scaler = state.actorsById[emitted.scalingOwnerId ?? ""];
    const source = state.actorsById[emitted.actorId];
    if (!owner || !scaler || !source) return;
    const resolved = resolveTeamActorAction(
      source.runtime,
      source.build,
      emitted.actionId,
    );
    if (resolved.status === "unsupported") return;
    const outcomes = calculateActionOutcomes(
      resolved.action.outcomes,
      resolved.action.level,
      scaler.finalStats,
    );
    for (const outcome of outcomes.outcomes) {
      const recipients = resolveTeamRecipients(
        outcome.target === "self" ? "self" : "team",
        owner.actorId,
        state,
      );
      if (outcome.kind === "healing") {
        healingEvents.push({
          timestamp: state.currentTimeSeconds,
          eventId: event.id,
          sourceEntityId: resolved.sourceEntityId,
          outcomeOwnerId: owner.actorId,
          scalingOwnerId: scaler.actorId,
          recipientActorIds: recipients,
          result: outcome,
        });
        emit(
          "heal-applied",
          owner.actorId,
          emitted.actorId,
          emitted.targetId,
          undefined,
          resolved.action.id,
        );
      } else {
        shieldEvents.push({
          timestamp: state.currentTimeSeconds,
          eventId: event.id,
          sourceEntityId: resolved.sourceEntityId,
          outcomeOwnerId: owner.actorId,
          scalingOwnerId: scaler.actorId,
          recipientActorIds: recipients,
          result: outcome,
        });
        emit(
          "shield-gained",
          owner.actorId,
          emitted.actorId,
          emitted.targetId,
          undefined,
          resolved.action.id,
        );
      }
    }
  };

  const triggerCoordinated = (triggeringActorId: string, targetId: string) => {
    for (const actor of Object.values(state.actorsById)) {
      for (const bound of actor.coordinatedResponses) {
        const targetState = state.targetsById[targetId];
        const status = Object.values(targetState?.statuses ?? {}).find(
          (candidate) =>
            candidate.definition.id === bound.definition.targetStatusId &&
            candidate.sourceOwnerId === bound.ownerActorId,
        );
        if (
          !status ||
          (status.expiresAt !== undefined &&
            status.expiresAt <= state.currentTimeSeconds)
        ) {
          continue;
        }
        const key = `coordinated:${bound.ownerActorId}:${bound.definition.id}:${targetId}`;
        if ((state.cooldowns[key] ?? -Infinity) > state.currentTimeSeconds) {
          continue;
        }
        state.cooldowns[key] =
          state.currentTimeSeconds + bound.definition.internalCooldownSeconds;
        scheduleTeamAction(state, {
          actorId: bound.ownerActorId,
          actionId: bound.definition.action.id,
          targetId,
          triggeringActorId,
          damageOwnerId: bound.ownerActorId,
          scalingOwnerId: bound.ownerActorId,
          attribution: "coordinated",
        });
      }
    }
  };

  const fireStructuredTriggers = (
    eventKind: CombatEvent["kind"],
    eventActorId: string,
    actionId: string,
    targetId: string,
  ) => {
    for (const boundActor of Object.values(state.actorsById)) {
      for (const bound of boundActor.runtime.effects) {
        for (const trigger of bound.definition.triggers ?? []) {
          if (trigger.event !== eventKind) continue;
          const eventActor = state.actorsById[eventActorId];
          const context = teamCombatContext(state, {
            actorId: eventActorId,
            ownerId: bound.ownerActorId,
            targetId,
            panelStats: boundActor.finalStats,
            actionId,
            event: {
              id: `trigger-context:${eventKind}:${eventActorId}:${actionId}`,
              timestamp: state.currentTimeSeconds,
              kind: eventKind,
              ownerId: bound.ownerActorId,
              actorId: eventActorId,
              targetId,
              actionId,
            },
          });
          if (eventActor && context.element === undefined) {
            context.element = eventActor.resonator.element;
          }
          if (
            (trigger.predicates ?? []).some(
              (predicate) =>
                evaluatePredicate(predicate, context).status !== "matched",
            )
          ) {
            continue;
          }
          const cooldownSeconds =
            trigger.cooldownSecondsBySequence?.[boundActor.sequence] ??
            trigger.cooldown?.seconds;
          const cooldownKey = `trigger:${bound.ownerActorId}:${bound.definition.id}:${trigger.id}:${
            trigger.cooldown?.scope === "target" ? targetId : "owner"
          }`;
          if (
            cooldownSeconds !== undefined &&
            (state.cooldowns[cooldownKey] ?? -Infinity) >
              state.currentTimeSeconds
          ) {
            continue;
          }

          for (const operation of trigger.operations) {
            if (
              operation.kind === "activate-effect" ||
              operation.kind === "refresh-effect"
            ) {
              const definition = boundActor.effects.find(
                (effect) => effect.id === operation.effectId,
              );
              if (!definition) {
                diagnostic(
                  "team-context-unsupported",
                  `Effect ${operation.effectId} is not defined for ${boundActor.actorId}.`,
                );
                continue;
              }
              activateTeamEffect(state, definition, bound.ownerActorId, {
                targetId,
              });
              continue;
            }
            if (operation.kind === "expire-effect") {
              const before = state.activeEffects.length;
              state.activeEffects = state.activeEffects.filter(
                (effect) =>
                  !(
                    effect.ownerId === bound.ownerActorId &&
                    effect.definition.id === operation.effectId
                  ),
              );
              if (state.activeEffects.length < before) {
                stateTransitions.push({
                  timestamp: state.currentTimeSeconds,
                  kind: "effect-expired",
                  detail: operation.effectId,
                  ownerId: bound.ownerActorId,
                });
              }
              continue;
            }
            if (operation.kind === "apply-status") {
              const definition = bound.definition.statuses?.find(
                (status) => status.id === operation.statusId,
              );
              if (!definition) {
                diagnostic(
                  "team-context-unsupported",
                  `Status ${operation.statusId} is not defined.`,
                );
                continue;
              }
              const amount =
                operation.stacks?.kind === "constant"
                  ? operation.stacks.value
                  : undefined;
              if (amount === undefined) {
                diagnostic(
                  "team-context-unsupported",
                  `Status ${operation.statusId} requires a resolvable stack amount.`,
                );
                continue;
              }
              applyTeamTargetStatus(
                state,
                targetId,
                definition,
                bound.ownerActorId,
                state.currentTimeSeconds,
                amount,
              );
              continue;
            }
            diagnostic(
              "team-context-unsupported",
              `Trigger operation ${operation.kind} is not executed by Team V0.2.`,
            );
          }
          if (cooldownSeconds !== undefined) {
            state.cooldowns[cooldownKey] =
              state.currentTimeSeconds + cooldownSeconds;
          }
        }
      }
    }
  };

  const expireRuntimeAt = (to: number) => {
    state.currentTimeSeconds = to;
    state.targetsById = Object.fromEntries(
      Object.entries(state.targetsById).map(([targetId, targetState]) => [
        targetId,
        {
          ...targetState,
          statuses: Object.fromEntries(
            Object.entries(targetState.statuses).filter(
              ([, status]) =>
                status.expiresAt === undefined || status.expiresAt > to,
            ),
          ),
        },
      ]),
    );
    const before = state.activeEffects;
    state.activeEffects = before.filter(
      (effect) =>
        effect.endTimeSeconds === undefined || effect.endTimeSeconds > to,
    );
    for (const effect of before) {
      if (!state.activeEffects.includes(effect)) {
        stateTransitions.push({
          timestamp: effect.endTimeSeconds!,
          kind: "effect-expired",
          detail: effect.definition.id,
          ownerId: effect.ownerId,
        });
      }
    }
    for (const [id, end] of Object.entries(state.cooldowns)) {
      if (end <= to) delete state.cooldowns[id];
    }
  };

  const advance = (to: number) => {
    while (
      state.eventQueue[0] &&
      state.eventQueue[0].event.timestamp <= to
    ) {
      const queued = state.eventQueue.shift()!;
      expireRuntimeAt(queued.event.timestamp);
      eventLog.push(queued.event);

      if (queued.execute) {
        if (queued.hitIndex !== undefined) {
          if (queued.event.actionId) {
            fireStructuredTriggers(
              "action-hit",
              queued.event.actorId,
              queued.event.actionId,
              queued.event.targetId,
            );
          }
          const supported = damage(
            queued.execute,
            queued.event,
            queued.hitIndex,
          );
          if (supported) {
            emit(
              "damage-dealt",
              queued.execute.damageOwnerId ?? queued.execute.actorId,
              queued.execute.actorId,
              queued.execute.targetId,
              {
                damageOwnerId: queued.execute.damageOwnerId,
                scalingOwnerId: queued.execute.scalingOwnerId,
                attribution: queued.execute.attribution,
              },
              queued.execute.actionId,
            );
            fireStructuredTriggers(
              "damage-dealt",
              queued.execute.actorId,
              queued.execute.actionId,
              queued.execute.targetId,
            );
            if (queued.execute.attribution !== "coordinated") {
              triggerCoordinated(
                queued.execute.actorId,
                queued.execute.targetId,
              );
            }
          }
        } else {
          const supported = damage(queued.execute, queued.event);
          if (supported) {
            emit(
              "damage-dealt",
              queued.execute.damageOwnerId ?? queued.execute.actorId,
              queued.execute.actorId,
              queued.execute.targetId,
              {
                damageOwnerId: queued.execute.damageOwnerId,
                scalingOwnerId: queued.execute.scalingOwnerId,
                attribution: queued.execute.attribution,
                aggregateDamage: true,
              },
              queued.execute.actionId,
            );
          }
        }
      } else if (queued.event.external) {
        if (queued.event.kind === "action-hit" && queued.event.actionId) {
          fireStructuredTriggers(
            "action-hit",
            queued.event.actorId,
            queued.event.actionId,
            queued.event.targetId,
          );
        }
        if (queued.event.kind === "damage-dealt") {
          if (queued.event.actionId) {
            fireStructuredTriggers(
              "damage-dealt",
              queued.event.actorId,
              queued.event.actionId,
              queued.event.targetId,
            );
          }
          triggerCoordinated(
            queued.event.actorId,
            queued.event.targetId,
          );
        }
      }
    }
    expireRuntimeAt(to);
  };

  for (const action of input.scheduledActions ?? []) {
    scheduleTeamAction(state, action);
  }
  for (const event of input.externalEvents ?? []) {
    enqueueTeamEvent(state, { event });
  }
  advance(state.currentTimeSeconds);

  for (const [index, step] of (input.steps ?? []).entries()) {
    if (step.kind === "wait") {
      if (!Number.isFinite(step.seconds) || step.seconds < 0) {
        diagnostic(
          "invalid-wait",
          "Wait must be finite and non-negative.",
          index,
        );
      } else {
        advance(state.currentTimeSeconds + step.seconds);
      }
      continue;
    }

    if (step.kind === "switch") {
      const incoming = state.actorsById[step.toActorId];
      const outgoing = state.actorsById[state.activeActorId];
      if (!incoming) {
        diagnostic(
          "invalid-switch-target",
          `${step.toActorId} is not in the team.`,
          index,
        );
        continue;
      }
      if (step.toActorId === state.activeActorId) {
        diagnostic(
          "invalid-switch-target",
          `${step.toActorId} is already active.`,
          index,
        );
        continue;
      }
      if (incoming.switchReadyAtSeconds > state.currentTimeSeconds) {
        diagnostic(
          "switch-cooldown",
          `${step.toActorId} cannot return before ${incoming.switchReadyAtSeconds}.`,
          index,
        );
        continue;
      }
      if (!outgoing) {
        diagnostic("unknown-team-actor", state.activeActorId, index);
        continue;
      }

      emit("switch-out", outgoing.actorId, outgoing.actorId);
      const readiness = (
        outgoing.switchReadiness?.length
          ? outgoing.switchReadiness
          : [{ kind: "full-resource", semantic: "concerto-energy" } as const]
      ).find((rule) =>
        rule.kind === "full-resource"
          ? Object.values(outgoing.resources).some(
              (resource) =>
                resource.semantic === rule.semantic &&
                resource.current === resource.max,
            )
          : outgoing.states.includes(rule.stateId),
      );

      if (readiness) {
        emit("outro", outgoing.actorId, outgoing.actorId, "target", {
          incomingActorId: incoming.actorId,
          structuredEffectIds: outgoing.runtime.outroEffects.map(
            (effect) => effect.definition.id,
          ),
        });
        for (const bound of outgoing.runtime.outroEffects) {
          for (const trigger of bound.definition.triggers ?? []) {
            if (trigger.event !== "outro") continue;
            for (const operation of trigger.operations) {
              if (operation.kind !== "activate-effect") continue;
              const definition = outgoing.effects.find(
                (effect) => effect.id === operation.effectId,
              );
              if (definition) {
                activateTeamEffect(state, definition, outgoing.actorId, {
                  incomingActorId: incoming.actorId,
                  targetId: "target",
                });
              }
            }
          }
        }
        if (readiness.kind === "full-resource") {
          for (const resource of Object.values(outgoing.resources)) {
            if (resource.semantic === readiness.semantic) resource.current = 0;
          }
        } else if (readiness.consumeOnUse) {
          outgoing.states = outgoing.states.filter(
            (stateId) => stateId !== readiness.stateId,
          );
        }
      }

      outgoing.switchReadyAtSeconds =
        state.currentTimeSeconds + SWITCH_BACK_COOLDOWN_SECONDS;
      state.cooldowns[`switch-return:${outgoing.actorId}`] =
        outgoing.switchReadyAtSeconds;
      for (const effect of [...state.activeEffects]) {
        const life = effect.definition.lifecycle?.endOnSwitchOut;
        if (
          (life === "owner" && effect.ownerId === outgoing.actorId) ||
          (life === "affected-recipient" &&
            effect.affectedEntityIds?.includes(outgoing.actorId))
        ) {
          state.activeEffects = state.activeEffects.filter(
            (candidate) => candidate !== effect,
          );
          stateTransitions.push({
            timestamp: state.currentTimeSeconds,
            kind: "effect-expired-switch-out",
            detail: effect.definition.id,
            ownerId: effect.ownerId,
          });
        }
      }

      state.activeActorId = incoming.actorId;
      emit("switch-in", incoming.actorId, incoming.actorId);
      if (readiness) {
        const candidates = discoverTeamIntroActions(incoming.runtime).filter(
          (action) =>
            !action.requiredForm || action.requiredForm === incoming.currentForm,
        );
        emit("intro", incoming.actorId, incoming.actorId, "target", {
          actionIds: candidates.map((action) => action.id),
        });
        if (candidates.length !== 1) {
          diagnostic(
            "requirement-context-required",
            `Expected one valid structured Intro for ${incoming.actorId}; found ${candidates.length}.`,
            index,
          );
        } else {
          const intro = candidates[0]!;
          const resolved = resolveTeamActorAction(
            incoming.runtime,
            incoming.build,
            intro.id,
          );
          if (resolved.status === "unsupported") {
            diagnostic(resolved.code, resolved.message, index);
          } else {
            const before = resolveActionResourceTransaction(
              incoming.resources,
              resolved.action.resourceOperations ?? [],
              "before-action",
              incoming.sequence,
            );
            if (before.status === "rejected") {
              diagnostic(
                "action-resource-rejected",
                `Intro resource transaction rejected for ${resolved.action.id}.`,
                index,
              );
            } else {
              incoming.resources = Object.fromEntries(
                Object.entries(before.resources).map(([id, resource]) => [
                  id,
                  { ...incoming.resources[id], ...resource },
                ]),
              );
              const introStart = emit(
                "action-start",
                incoming.actorId,
                incoming.actorId,
                "target",
                { sourceEntityId: resolved.sourceEntityId },
                resolved.action.id,
              );
              fireStructuredTriggers(
                "action-start",
                incoming.actorId,
                resolved.action.id,
                "target",
              );
              const emitted: TeamEmittedAction = {
                actorId: incoming.actorId,
                actionId: resolved.action.id,
                targetId: "target",
                damageOwnerId: incoming.actorId,
                scalingOwnerId: incoming.actorId,
                triggeringActorId: outgoing.actorId,
                attribution: "direct",
              };
              recordActionOutcomes(emitted, introStart);
              scheduleTeamAction(state, emitted);
              // Preserve previous ordering for zero-offset Intro damage: damage
              // resolves before its after-action resource transaction.
              advance(state.currentTimeSeconds);
              const after = resolveActionResourceTransaction(
                incoming.resources,
                resolved.action.resourceOperations ?? [],
                "after-action",
                incoming.sequence,
              );
              if (after.status === "applied") {
                incoming.resources = Object.fromEntries(
                  Object.entries(after.resources).map(([id, resource]) => [
                    id,
                    { ...incoming.resources[id], ...resource },
                  ]),
                );
              }
            }
          }
        }
      }
      continue;
    }

    const actor = state.actorsById[step.actorId];
    if (!actor) {
      diagnostic("unknown-team-actor", step.actorId, index);
      continue;
    }
    if (step.actorId !== state.activeActorId) {
      diagnostic(
        "inactive-actor-action",
        `${step.actorId} cannot directly execute an on-field action.`,
        index,
      );
      continue;
    }
    const resolution = resolveTeamActorAction(
      actor.runtime,
      actor.build,
      step.actionId,
    );
    if (resolution.status === "unsupported") {
      diagnostic(resolution.code, resolution.message, index);
      continue;
    }

    const targetId = step.targetId ?? "target";
    const replacement = resolveUniversalActionReplacement(
      resolution.action,
      actor.actions,
      state.activeEffects,
      teamCombatContext(state, {
        actorId: actor.actorId,
        ownerId: actor.actorId,
        targetId,
        panelStats: actor.finalStats,
        actionId: resolution.action.id,
        damageType:
          resolution.action.damageType === "tuneRupture"
            ? undefined
            : resolution.action.damageType,
      }),
      actor.sequence,
    );
    if (replacement.status === "unsupported") {
      diagnostic(
        replacement.code as TeamDiagnosticCode,
        replacement.message,
        index,
      );
      continue;
    }
    const replacementResolution = resolveTeamActorAction(
      actor.runtime,
      actor.build,
      replacement.action.id,
    );
    if (replacementResolution.status === "unsupported") {
      diagnostic(
        replacementResolution.code,
        replacementResolution.message,
        index,
      );
      continue;
    }
    const action = replacementResolution.action;

    if (action.requiredForm && actor.currentForm !== action.requiredForm) {
      diagnostic(
        "requirement-context-required",
        `${action.id} requires form ${action.requiredForm}; current form is ${actor.currentForm ?? "unknown"}.`,
        index,
      );
      continue;
    }
    if (action.requiredState?.length) {
      diagnostic(
        "requirement-context-required",
        `${action.id} has legacy requirements that Team Engine cannot prove.`,
        index,
      );
      continue;
    }

    const cooldownKey = `action:${actor.actorId}:${action.id}`;
    if ((state.cooldowns[cooldownKey] ?? -Infinity) > state.currentTimeSeconds) {
      diagnostic(
        "action-cooldown",
        `${action.id} is unavailable until ${state.cooldowns[cooldownKey]}.`,
        index,
      );
      continue;
    }
    const before = resolveActionResourceTransaction(
      actor.resources,
      action.resourceOperations ?? [],
      "before-action",
      actor.sequence,
    );
    if (before.status === "rejected") {
      diagnostic(
        "action-resource-rejected",
        `Before-action resource transaction rejected for ${action.id}: ${before.diagnostic}.`,
        index,
      );
      continue;
    }
    actor.resources = Object.fromEntries(
      Object.entries(before.resources).map(([id, resource]) => [
        id,
        { ...actor.resources[id], ...resource },
      ]),
    );

    const start = emit(
      "action-start",
      actor.actorId,
      actor.actorId,
      targetId,
      { sourceEntityId: replacementResolution.sourceEntityId },
      action.id,
    );
    fireStructuredTriggers(
      "action-start",
      actor.actorId,
      action.id,
      targetId,
    );
    if (action.cooldownSeconds !== undefined) {
      state.cooldowns[cooldownKey] =
        state.currentTimeSeconds + action.cooldownSeconds;
    }

    const emitted: TeamEmittedAction = {
      actorId: actor.actorId,
      actionId: action.id,
      targetId,
      damageOwnerId: actor.actorId,
      scalingOwnerId: actor.actorId,
      triggeringActorId: actor.actorId,
      attribution: "direct",
    };
    recordActionOutcomes(emitted, start);
    scheduleTeamAction(state, emitted);

    const verified = action.castDurationSeconds.value;
    const duration = step.durationOverrideSeconds ?? verified;
    if (duration === null || duration === undefined) {
      diagnostic(
        "timing-required",
        `Action ${action.id} requires an explicit duration.`,
        index,
        start.id,
      );
      timingComplete = false;
      advance(state.currentTimeSeconds);
    } else if (!Number.isFinite(duration) || duration < 0) {
      diagnostic(
        "timing-required",
        `${
          step.durationOverrideSeconds !== undefined
            ? "Manual duration override"
            : "Verified duration"
        } for ${action.id} must be finite and non-negative.`,
        index,
        start.id,
      );
      timingComplete = false;
      advance(state.currentTimeSeconds);
    } else {
      if (step.durationOverrideSeconds !== undefined) {
        stateTransitions.push({
          timestamp: state.currentTimeSeconds,
          kind: "duration-override",
          detail: `${action.id}:${step.durationOverrideSeconds}`,
          eventId: start.id,
          ownerId: actor.actorId,
        });
      }
      advance(state.currentTimeSeconds + duration);
    }

    const after = resolveActionResourceTransaction(
      actor.resources,
      action.resourceOperations ?? [],
      "after-action",
      actor.sequence,
    );
    if (after.status === "applied") {
      actor.resources = Object.fromEntries(
        Object.entries(after.resources).map(([id, resource]) => [
          id,
          { ...actor.resources[id], ...resource },
        ]),
      );
    }
    emit(
      "action-end",
      actor.actorId,
      actor.actorId,
      targetId,
      undefined,
      action.id,
    );
  }

  advance(state.currentTimeSeconds);
  const damageByActorId: Record<string, DamageAmounts> = {};
  for (const event of damageEvents) {
    if (event.damage.status === "supported") {
      damageByActorId[event.damageOwnerId] = add(
        damageByActorId[event.damageOwnerId] ?? zero(),
        event.damage.total,
      );
    }
  }
  const totalResolvedDamage = Object.values(damageByActorId).reduce(
    add,
    zero(),
  );
  return {
    currentTimeSeconds: state.currentTimeSeconds,
    resolvedDurationSeconds: timingComplete
      ? state.currentTimeSeconds - startTimeSeconds
      : undefined,
    activeActorId: state.activeActorId,
    actorsById: state.actorsById,
    targetsById: state.targetsById,
    activeEffects: state.activeEffects,
    eventLog: [...eventLog].sort(
      (left, right) =>
        left.timestamp - right.timestamp || left.id.localeCompare(right.id),
    ),
    damageEvents,
    healingEvents,
    shieldEvents,
    stateTransitions,
    diagnostics: state.diagnostics,
    coverage: state.coverage,
    partial: state.diagnostics.length > 0,
    totalResolvedDamage,
    damageByActorId,
    finalState: state,
  };
}

export function setTeamTargetStatus(
  state: TeamState,
  targetId: string,
  statusId: string,
  status: ActiveStatus,
): void {
  const target = state.targetsById[targetId] ?? emptyTarget();
  state.targetsById[targetId] = {
    ...target,
    statuses: { ...target.statuses, [statusId]: status },
  };
}

/** Applies exact structured status data at an explicit timestamp; useful when cast timing is unknown. */
export function applyTeamTargetStatus(
  state: TeamState,
  targetId: string,
  definition: StatusDefinition,
  ownerActorId: string,
  timestamp: number,
  stacks = 1,
): void {
  if (!state.actorsById[ownerActorId]) {
    state.diagnostics.push({
      code: "unbound-runtime-owner",
      message: `Status owner ${ownerActorId} is not in the team.`,
    });
    return;
  }
  const target = state.targetsById[targetId] ?? emptyTarget();
  const key = `${definition.id}::${ownerActorId}`;
  const current = target.statuses[key];
  state.targetsById[targetId] = {
    ...target,
    statuses: {
      ...target.statuses,
      [key]: {
        definition,
        sourceOwnerId: ownerActorId,
        stacks: Math.min(definition.maxStacks, (current?.stacks ?? 0) + stacks),
        expiresAt:
          definition.durationSeconds === undefined
            ? undefined
            : timestamp + definition.durationSeconds,
      },
    },
  };
}

export function cloneTeamState(state: TeamState): TeamState {
  return {
    ...state,
    actorsById: Object.fromEntries(
      Object.entries(state.actorsById).map(([id, actor]) => [
        id,
        {
          ...actor,
          resources: Object.fromEntries(
            Object.entries(actor.resources).map(([resourceId, resource]) => [
              resourceId,
              { ...resource },
            ]),
          ),
          states: [...actor.states],
        },
      ]),
    ),
    targetsById: structuredClone(state.targetsById),
    activeEffects: state.activeEffects.map((effect) => ({
      ...effect,
      affectedEntityIds: effect.affectedEntityIds
        ? [...effect.affectedEntityIds]
        : undefined,
    })),
    cooldowns: { ...state.cooldowns },
    eventQueue: state.eventQueue.map((item) => ({
      event: {
        ...item.event,
        payload: item.event.payload ? { ...item.event.payload } : undefined,
      },
      execute: item.execute ? { ...item.execute } : undefined,
      hitIndex: item.hitIndex,
    })),
    queuedEventSerial: state.queuedEventSerial,
    diagnostics: [],
    coverage: { supported: 0, unsupported: 0 },
  };
}

export function simulateTeamContinuation(
  finalState: TeamState,
  steps: readonly TeamRotationStep[],
  target: DamageTarget,
): TeamSimulationResult {
  return simulateTeam({
    actors: [],
    activeActorId: finalState.activeActorId,
    target,
    steps,
    initialState: finalState,
  });
}
