import type { DamageType } from "./damage-engine";
import type { Element, SourceMetadata } from "./models";
import type { CombatAction } from "./models";

export const effectSourceTypes = [
  "resonator", "weapon", "sonata", "echo", "resonance-chain", "system",
] as const;
export type EffectSourceType = (typeof effectSourceTypes)[number];
export type EffectTargetScope = "self" | "enemy" | "team" | "other-team-members";
export type EffectAccounting = "runtime" | "already-in-final-stats" | "informational";
export type StackingPolicy = "additive" | "highest" | "override";

export type RuntimeStat = "attack" | "hp" | "defense" | "energyRegen" | "critRate" |
  "critDamage" | "healingBonus" | "tuneBreakBoost" | (string & {});
export type RuntimeStatModifierKind = "percent" | "flat";

/** Closed, serialisable expression language. Evaluation never executes data as code. */
export type ValueExpression =
  | { kind: "constant"; value: number }
  | { kind: "stacks" }
  | { kind: "rank"; values: Readonly<Record<number, number>> }
  | { kind: "stat"; stat: RuntimeStat; view?: "panel" | "effective" }
  | { kind: "resource"; resourceId: string; ownerId?: string }
  | { kind: "add" | "multiply" | "min" | "max"; values: readonly ValueExpression[] }
  | { kind: "subtract"; left: ValueExpression; right: ValueExpression }
  | { kind: "clamp"; value: ValueExpression; min: number; max: number }
  | { kind: "cap"; value: ValueExpression; max: number }
  | { kind: "stack-threshold"; threshold: number; then: ValueExpression; otherwise?: ValueExpression };

export type Comparison = "eq" | "gte" | "lte";
export type CombatPredicate =
  | { kind: "and" | "or"; predicates: readonly CombatPredicate[] }
  | { kind: "not"; predicate: CombatPredicate }
  | { kind: "identity"; field: "actorId" | "ownerId" | "sourceId" | "damageOwnerId" | "targetId" | "actionId" | "damageType" | "element" | "resonanceMode" | "form" | "eventKind" | "eventSourceId" | "eventTargetId"; anyOf: readonly string[] }
  | { kind: "action-category"; anyOf: readonly string[] }
  | { kind: "number"; field: "actorHpRatio" | "targetHpRatio"; comparison: Comparison; value: number }
  | { kind: "stat"; stat: RuntimeStat; comparison: Comparison; value: ValueExpression }
  | { kind: "resource"; resourceId: string; comparison: Comparison | "max" | "available"; value?: ValueExpression }
  | { kind: "has-effect" | "has-status" | "target-has-status" | "state-active"; id: string; minStacks?: number }
  | { kind: "shield-active" }
  | { kind: "on-field"; value: boolean }
  | { kind: "inside-domain"; domainId: string };

export interface EffectLifecycle {
  duration: { kind: "indefinite" } | { kind: "fixed"; seconds: number };
  refresh?: "no-refresh" | "reset-duration" | "reset-only-below-max-stacks" | "no-reset-at-max-stacks";
  extension?: { seconds: number; limitSeconds: number; maxExtensions?: number };
  uniqueness?: "replace-existing" | "refresh-existing" | "reject-duplicate" | "same-name";
  exclusiveGroup?: string;
  stacks?: { kind: "shared" | "independent-expirations"; max: number; initial?: number };
}
export type CooldownScope = "global" | "owner" | "source" | "action" | "target" | "action-target" | "source-target" | "element" | "custom";
export interface CooldownDefinition { seconds: number; scope: CooldownScope; customKey?: string; maxTriggers?: number; }
export type TriggerCountScope = "global" | "owner" | "target" | "owner-target" | "instance";

export type CombatEventKind = "rotation-step-start" | "action-start" | "action-end" | "action-hit" |
  "damage-dealt" | "critical-hit" | "successful-dodge" | "intro" | "outro" | "switch-in" |
  "switch-out" | "echo-skill" | "resource-gained" | "resource-consumed" | "state-enter" |
  "state-exit" | "effect-activated" | "effect-expired" | "stacks-gained" | "stacks-consumed" |
  "heal-applied" | "shield-gained" | "shield-lost" | "status-applied" | "status-stack-changed" |
  "target-defeated" | "tune-break" | "tune-rupture" | "fusion-burst" | "custom";
export type SnapshotPolicy = { stats: "trigger" | "hit" | "unknown"; stacks: "trigger" | "tick" | "unknown" };
export interface EmittedActionDefinition { actionId: string; delaySeconds?: number; actorId?: string; damageOwnerId?: string; scalingOwnerId?: string; attribution?: "direct" | "echo" | "follow-up" | "coordinated" | "summon" | "status" | "tune"; snapshot: SnapshotPolicy; }
export type TriggerOperation =
  | { kind: "activate-effect" | "refresh-effect" | "expire-effect"; effectId: string }
  | { kind: "extend-effect"; effectId: string }
  | { kind: "gain-stacks" | "consume-stacks"; effectId: string; amount: ValueExpression | "all" }
  | { kind: "clear-stacks"; effectId: string }
  | { kind: "resource"; operation: "gain" | "consume" | "set" | "set-max" | "consume-all" | "consume-up-to"; resourceId: string; amount?: ValueExpression }
  | { kind: "apply-status" | "remove-status"; statusId: string; targetId?: string; stacks?: ValueExpression }
  | { kind: "enter-state" | "exit-state" | "change-form"; stateId: string }
  | { kind: "start-cooldown"; cooldown: CooldownDefinition }
  | { kind: "emit-event"; eventKind: CombatEventKind; delaySeconds: number }
  | { kind: "emit-action"; action: EmittedActionDefinition };
export interface TriggerDefinition { id: string; event: CombatEventKind; predicates?: readonly CombatPredicate[]; operations: readonly TriggerOperation[]; cooldown?: CooldownDefinition; maxTriggers?: number; triggerCountScope?: TriggerCountScope; externalContextRequired?: boolean; }
export interface StatusDefinition { id: string; label: string; maxStacks: number; durationSeconds?: number; periodic?: { intervalSeconds: number; maxTicks: number; emittedAction: EmittedActionDefinition; consumeStacks?: number | "all" }; transformAtMaxTo?: string; }

export type EffectSelector =
  | { kind: "element"; anyOf: readonly Element[] }
  | { kind: "damage-type"; anyOf: readonly DamageType[] }
  | { kind: "resonance-mode"; anyOf: readonly string[] }
  | { kind: "action-id"; anyOf: readonly string[] }
  | { kind: "action-category"; anyOf: readonly string[] }
  | { kind: "owner-id"; anyOf: readonly string[] }
  | { kind: "source-id"; anyOf: readonly string[] }
  | { kind: "target-id"; anyOf: readonly string[] };

export type ModifierKind =
  | "all-damage-bonus"
  | "elemental-damage-bonus"
  | "damage-type-bonus"
  | "damage-amplification"
  | "defense-reduction"
  | "defense-ignore"
  | "resistance-reduction"
  | "resistance-ignore"
  | "crit-rate-bonus"
  | "crit-damage-bonus"
  | "temporary-tune-break-boost";

export interface LinearModifierValue {
  value?: number;
  valuePerStack?: number;
  maxStacks?: number;
}

export interface EffectModifier extends LinearModifierValue {
  kind: ModifierKind;
  stacking: StackingPolicy;
  valueExpression?: ValueExpression;
}

export interface RuntimeStatModifier { kind: "runtime-stat"; stat: RuntimeStat; mode: RuntimeStatModifierKind; stacking: StackingPolicy; value: ValueExpression; }
export interface MotionValueModifier { kind: "motion-value"; mode: "additive-percent" | "multiplier"; stacking: StackingPolicy; value: ValueExpression; }
export interface ActionReplacementModifier { kind: "action-replacement"; actionId: string; replacementActionId: string; condition: CombatPredicate; }
export interface DamageTypeReplacementModifier { kind: "damage-type-replacement"; damageType: DamageType; condition: CombatPredicate; }

export interface FixedCritOverrideModifier {
  kind: "fixed-crit-override";
  stacking: "override";
  critRatePercent: number;
  critDamagePercent: number;
}

export interface EffectRuleDefinition {
  id: string;
  label: string;
  accounting: EffectAccounting;
  selectors?: readonly EffectSelector[];
  modifiers: readonly (EffectModifier | FixedCritOverrideModifier | RuntimeStatModifier | MotionValueModifier | ActionReplacementModifier | DamageTypeReplacementModifier)[];
  predicates?: readonly CombatPredicate[];
  requiredSequence?: number;
}

export interface EffectDefinition {
  id: string;
  label: string;
  source: {
    id: string;
    type: EffectSourceType;
    label: string;
    metadata?: SourceMetadata;
  };
  target: EffectTargetScope;
  rules: readonly EffectRuleDefinition[];
  /** Legacy documentation-only activation metadata; structured lifecycle/triggers are executed instead. */
  activation?: { description: string; durationSeconds?: number };
  lifecycle?: EffectLifecycle;
  triggers?: readonly TriggerDefinition[];
  statuses?: readonly StatusDefinition[];
}

export interface ActionDefinitionV02 {
  action: CombatAction;
  multipliersByTalentLevel?: Readonly<Record<number, CombatAction["multipliers"]>>;
  requirements?: readonly CombatPredicate[];
}

export interface ActiveEffectInstance {
  id: string;
  definition: EffectDefinition;
  ownerId: string;
  sourceId?: string;
  affectedEntityIds?: readonly string[];
  stacks?: number;
  rank?: number;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
}
