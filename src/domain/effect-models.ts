import type { DamageType } from "./damage-engine";
import type { Element, SourceMetadata } from "./models";

export const effectSourceTypes = [
  "resonator", "weapon", "sonata", "echo", "resonance-chain", "system",
] as const;
export type EffectSourceType = (typeof effectSourceTypes)[number];
export type EffectTargetScope = "self" | "enemy" | "team" | "other-team-members";
export type EffectAccounting = "runtime" | "already-in-final-stats" | "informational";
export type StackingPolicy = "additive" | "highest" | "override";

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
}

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
  modifiers: readonly (EffectModifier | FixedCritOverrideModifier)[];
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
  /** Documentation for the future State Engine. Never executed by this resolver. */
  activation?: { description: string; durationSeconds?: number };
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

