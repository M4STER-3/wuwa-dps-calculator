import type { CoordinatedResponseDefinition } from "./coordinated-response-engine";
import type { EffectDefinition } from "./effect-models";
import type { CombatAction, CombatResource, MainEcho, Resonator, Sonata, UserBuild, Weapon } from "./models";
import { resolveActionTalentLevel } from "./talent-engine";

export interface TeamRuntimeBindingInput {
  actorId: string;
  resonator: Resonator;
  build: UserBuild;
  weapon?: Weapon;
  sonata?: Sonata;
  mainEcho?: MainEcho;
  actions?: readonly CombatAction[];
  effects?: readonly EffectDefinition[];
  coordinatedResponses?: readonly CoordinatedResponseDefinition[];
}

export interface BoundTeamEffect {
  definition: EffectDefinition;
  ownerActorId: string;
  sourceEntityId: string;
}

export interface BoundCoordinatedResponse {
  definition: CoordinatedResponseDefinition;
  ownerActorId: string;
  sourceEntityId: string;
}

export interface BoundTeamActorRuntime {
  actorId: string;
  resonatorId: string;
  actionsById: Readonly<Record<string, CombatAction>>;
  introActionIds: readonly string[];
  effects: readonly BoundTeamEffect[];
  outroEffects: readonly BoundTeamEffect[];
  coordinatedResponses: readonly BoundCoordinatedResponse[];
  resources: readonly CombatResource[];
}

/** Creates actor-owned wrappers without mutating catalog singleton objects. */
export function bindTeamActorRuntime(input: TeamRuntimeBindingInput): BoundTeamActorRuntime {
  const actions = [
    ...(input.resonator.combat?.actions ?? []),
    ...(input.mainEcho?.action ? [input.mainEcho.action] : []),
    ...(input.actions ?? []),
    ...(input.coordinatedResponses ?? []).map((response) => response.action),
  ];
  const definitions = [
    ...(input.resonator.combat?.effects ?? []).flatMap((effect) => effect.structuredEffect ? [effect.structuredEffect] : []),
    ...(input.weapon?.effects ?? []).flatMap((effect) => effect.structuredEffect ? [effect.structuredEffect] : []),
    ...(input.sonata?.effects ?? []).flatMap((effect) => effect.structuredEffect ? [effect.structuredEffect] : []),
    ...(input.mainEcho?.effects ?? []).flatMap((effect) => effect.structuredEffect ? [effect.structuredEffect] : []),
    ...(input.effects ?? []),
  ];
  const effects = [...new Map(definitions.map((definition) => [definition.id, definition])).values()]
    .map((definition) => ({ definition, ownerActorId: input.actorId, sourceEntityId: definition.source.id }));
  return {
    actorId: input.actorId,
    resonatorId: input.resonator.id,
    actionsById: Object.fromEntries(actions.map((action) => [action.id, action])),
    introActionIds: actions.filter((action) => action.talent === "introSkill").map((action) => action.id),
    effects,
    outroEffects: effects.filter(({ definition }) => definition.triggers?.some((trigger) => trigger.event === "outro")),
    coordinatedResponses: (input.coordinatedResponses ?? []).map((definition) => ({
      definition,
      ownerActorId: input.actorId,
      sourceEntityId: definition.ownerId,
    })),
    resources: input.resonator.combat?.resources ?? [],
  };
}

export type TeamActionResolution =
  | { status: "supported"; actorId: string; resonatorId: string; sourceEntityId: string; action: CombatAction }
  | { status: "unsupported"; code: "unknown-action" | "missing-exact-talent-data"; message: string };

export function resolveTeamActorAction(runtime: BoundTeamActorRuntime, build: UserBuild, actionId: string): TeamActionResolution {
  const action = runtime.actionsById[actionId];
  if (!action) return { status: "unsupported", code: "unknown-action", message: `Unknown action ${actionId} for actor ${runtime.actorId}.` };
  const talentLevel = build.skillLevels[action.talent as keyof UserBuild["skillLevels"]];
  const resolution = talentLevel === undefined ? { status: "supported" as const, action } : resolveActionTalentLevel(action, talentLevel);
  if (resolution.status === "unsupported") return { status: "unsupported", code: resolution.reason, message: resolution.message };
  return { status: "supported", actorId: runtime.actorId, resonatorId: runtime.resonatorId, sourceEntityId: action.id, action: resolution.action };
}

export function discoverTeamIntroActions(runtime: BoundTeamActorRuntime): readonly CombatAction[] {
  return runtime.introActionIds.map((id) => runtime.actionsById[id]);
}
