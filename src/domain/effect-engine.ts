import type { DamageModifiers, DamageType, TuneCritOverride, TuneDamageModifiers } from "./damage-engine";
import type {
  ActiveEffectInstance, EffectModifier, EffectRuleDefinition, EffectSelector,
  EffectTargetScope, FixedCritOverrideModifier, ModifierKind, StackingPolicy,
} from "./effect-models";
import type { Element } from "./models";
import { evaluatePredicate, type CombatContext } from "./combat-context";

export interface EffectResolutionContext {
  actorId: string;
  targetId: string;
  teamMemberIds: readonly string[];
  element?: Element;
  damageType?: DamageType;
  resonanceMode?: string;
  actionId?: string;
  actionCategories?: readonly string[];
  combatContext?: CombatContext;
}

export type EffectDiagnosticCode =
  | "unsupported-modifier-kind" | "unsupported-selector" | "unsupported-stacking-policy"
  | "invalid-value" | "invalid-stacks" | "missing-context" | "conflicting-overrides";
export interface EffectDiagnostic { code: EffectDiagnosticCode; message: string; instanceId: string; ruleId: string; }
export type AuditStatus = "matched" | "ignored" | "unsupported";
export interface ResolvedContribution { kind: ModifierKind | "fixed-crit-override"; value?: number; critOverride?: TuneCritOverride; stacking: StackingPolicy; }
export interface EffectAuditEntry {
  instanceId: string; effectId: string; sourceId: string; sourceType: string; sourceLabel: string;
  ruleId: string; ruleLabel: string; status: AuditStatus; reason: string;
  contributions: readonly ResolvedContribution[];
}
export interface EffectResolutionResult {
  damageModifiers: DamageModifiers;
  tuneDamageModifiers: TuneDamageModifiers;
  overrides: { fixedCrit?: TuneCritOverride };
  audit: readonly EffectAuditEntry[];
  diagnostics: readonly EffectDiagnostic[];
}

type NumericChannel = keyof DamageModifiers | keyof TuneDamageModifiers;
interface Pending { channel: NumericChannel; value: number; policy: StackingPolicy; auditIndex: number; tune: boolean; }

const modifierChannels: Record<ModifierKind, { channel: NumericChannel; tune?: boolean }> = {
  "all-damage-bonus": { channel: "allDamageBonusPercent" },
  "elemental-damage-bonus": { channel: "additionalElementalDamageBonusPercent" },
  "damage-type-bonus": { channel: "additionalDamageTypeBonusPercent" },
  "damage-amplification": { channel: "damageAmplificationPercent" },
  "defense-reduction": { channel: "defenseReduction" },
  "defense-ignore": { channel: "defenseIgnore" },
  "resistance-reduction": { channel: "resistanceReduction" },
  "resistance-ignore": { channel: "resistanceIgnore" },
  "crit-rate-bonus": { channel: "critRateBonusPercent" },
  "crit-damage-bonus": { channel: "critDamageBonusPercent" },
  "temporary-tune-break-boost": { channel: "temporaryTuneBreakBoostPercent", tune: true },
};

export function resolveActiveEffects(instances: readonly ActiveEffectInstance[], context: EffectResolutionContext): EffectResolutionResult {
  const audit: EffectAuditEntry[] = [];
  const diagnostics: EffectDiagnostic[] = [];
  const pending: Pending[] = [];
  const critOverrides: Array<{ value: TuneCritOverride; auditIndex: number; instanceId: string; ruleId: string }> = [];

  for (const instance of instances) {
    for (const rule of instance.definition.rules) {
      const base = { instanceId: instance.id, effectId: instance.definition.id, sourceId: instance.definition.source.id,
        sourceType: instance.definition.source.type, sourceLabel: instance.definition.source.label,
        ruleId: rule.id, ruleLabel: rule.label };
      if (rule.accounting !== "runtime") {
        audit.push({ ...base, status: "ignored", reason: rule.accounting, contributions: [] });
        continue;
      }
      const scopeReason = matchScope(instance.definition.target, instance, context);
      if (scopeReason) { audit.push({ ...base, status: "ignored", reason: scopeReason, contributions: [] }); continue; }
      const selectorResult = matchSelectors(rule.selectors ?? [], instance, context);
      if (selectorResult.reason) {
        const status = selectorResult.unsupported ? "unsupported" : "ignored";
        audit.push({ ...base, status, reason: selectorResult.reason, contributions: [] });
        if (selectorResult.diagnostic) diagnostics.push({ ...selectorResult.diagnostic, instanceId: instance.id, ruleId: rule.id });
        continue;
      }
      if (rule.predicates?.length) {
        if (!context.combatContext) {
          audit.push({ ...base, status: "unsupported", reason: "missing-context:predicate", contributions: [] });
          diagnostics.push({ code: "missing-context", message: "Combat Context required by predicates is missing.", instanceId: instance.id, ruleId: rule.id });
          continue;
        }
        const predicateResults = rule.predicates.map((predicate) => evaluatePredicate(predicate, context.combatContext!));
        if (predicateResults.some((result) => result.status === "unsupported")) {
          audit.push({ ...base, status: "unsupported", reason: "predicate-unsupported", contributions: [] });
          diagnostics.push({ code: "missing-context", message: "A rule predicate could not be resolved.", instanceId: instance.id, ruleId: rule.id });
          continue;
        }
        if (predicateResults.some((result) => result.status === "ignored")) {
          audit.push({ ...base, status: "ignored", reason: "predicate-false", contributions: [] });
          continue;
        }
      }
      const index = audit.length;
      const contributions: ResolvedContribution[] = [];
      let unsupported = false;
      for (const modifier of rule.modifiers) {
        if (modifier.kind === "fixed-crit-override") {
          const fixed = modifier as FixedCritOverrideModifier;
          if (!validNumber(fixed.critRatePercent) || !validNumber(fixed.critDamagePercent)) {
            diagnostics.push(diag("invalid-value", "Fixed Crit override values must be finite.", instance, rule)); unsupported = true; continue;
          }
          const value = { critRatePercent: fixed.critRatePercent, critDamagePercent: fixed.critDamagePercent };
          critOverrides.push({ value, auditIndex: index, instanceId: instance.id, ruleId: rule.id });
          contributions.push({ kind: fixed.kind, critOverride: value, stacking: fixed.stacking }); continue;
        }
        const item = modifier as EffectModifier;
        const channel = modifierChannels[item.kind];
        if (!channel) { diagnostics.push(diag("unsupported-modifier-kind", `Unsupported modifier kind: ${String(item.kind)}.`, instance, rule)); unsupported = true; continue; }
        if (!(["additive", "highest", "override"] as const).includes(item.stacking)) {
          diagnostics.push(diag("unsupported-stacking-policy", `Unsupported stacking policy: ${String(item.stacking)}.`, instance, rule)); unsupported = true; continue;
        }
        const value = resolveValue(item, instance.stacks);
        if (value.error) { diagnostics.push(diag(value.code!, value.error, instance, rule)); unsupported = true; continue; }
        contributions.push({ kind: item.kind, value: value.value, stacking: item.stacking });
        pending.push({ channel: channel.channel, value: value.value!, policy: item.stacking, auditIndex: index, tune: channel.tune ?? false });
      }
      audit.push({ ...base, status: unsupported ? "unsupported" : "matched", reason: unsupported ? "one-or-more-modifiers-unsupported" : "selectors-matched", contributions });
    }
  }

  const damageModifiers: Record<string, number> = {};
  const tuneDamageModifiers: Record<string, number> = {};
  for (const [key, values] of groupPending(pending)) {
    const overrides = values.filter((v) => v.policy === "override");
    const highest = values.filter((v) => v.policy === "highest").map((v) => v.value);
    if (overrides.length > 1) diagnostics.push({ code: "conflicting-overrides", message: `Multiple overrides for ${key}; the last explicit override wins.`, instanceId: audit[overrides.at(-1)!.auditIndex].instanceId, ruleId: audit[overrides.at(-1)!.auditIndex].ruleId });
    const result = overrides.length ? overrides.at(-1)!.value :
      values.filter((v) => v.policy === "additive").reduce((sum, v) => sum + v.value, 0) + (highest.length ? Math.max(...highest) : 0);
    const target = values[0].tune ? tuneDamageModifiers : damageModifiers;
    target[key] = result;
  }
  let fixedCrit: TuneCritOverride | undefined;
  if (critOverrides.length) {
    fixedCrit = critOverrides.at(-1)!.value;
    if (critOverrides.length > 1) diagnostics.push({ code: "conflicting-overrides", message: "Multiple fixed Crit overrides; the last explicit override wins.", instanceId: critOverrides.at(-1)!.instanceId, ruleId: critOverrides.at(-1)!.ruleId });
  }
  return { damageModifiers, tuneDamageModifiers, overrides: { fixedCrit }, audit, diagnostics };
}

function resolveValue(modifier: EffectModifier, stacks: number | undefined): { value?: number; error?: string; code?: EffectDiagnosticCode } {
  if (modifier.valuePerStack !== undefined) {
    if (!Number.isInteger(stacks) || stacks! < 0) return { error: "A non-negative integer stack count is required.", code: "invalid-stacks" };
    if (modifier.maxStacks !== undefined && (!Number.isInteger(modifier.maxStacks) || modifier.maxStacks < 0)) return { error: "maxStacks must be a non-negative integer.", code: "invalid-stacks" };
    if (!validNumber(modifier.valuePerStack)) return { error: "valuePerStack must be finite.", code: "invalid-value" };
    return { value: modifier.valuePerStack * Math.min(stacks!, modifier.maxStacks ?? stacks!) };
  }
  if (!validNumber(modifier.value)) return { error: "Modifier value must be finite.", code: "invalid-value" };
  return { value: modifier.value };
}

function matchScope(scope: EffectTargetScope, instance: ActiveEffectInstance, context: EffectResolutionContext): string | undefined {
  const affected = instance.affectedEntityIds;
  if (affected && !affected.includes(scope === "enemy" ? context.targetId : context.actorId)) return "target-not-in-active-instance-scope";
  if (scope === "self" && context.actorId !== instance.ownerId) return "scope-self-mismatch";
  if (scope === "enemy" && !context.targetId) return "missing-target-context";
  if (scope === "team" && !context.teamMemberIds.includes(context.actorId)) return "scope-team-mismatch";
  if (scope === "other-team-members" && (context.actorId === instance.ownerId || !context.teamMemberIds.includes(context.actorId))) return "scope-other-team-members-mismatch";
  return undefined;
}

function matchSelectors(selectors: readonly EffectSelector[], instance: ActiveEffectInstance, context: EffectResolutionContext) {
  for (const selector of selectors) {
    let actual: string | readonly string[] | undefined;
    switch (selector.kind) {
      case "element": actual = context.element; break;
      case "damage-type": actual = context.damageType; break;
      case "resonance-mode": actual = context.resonanceMode; break;
      case "action-id": actual = context.actionId; break;
      case "action-category": actual = context.actionCategories; break;
      case "owner-id": actual = instance.ownerId; break;
      case "source-id": actual = instance.sourceId ?? instance.definition.source.id; break;
      case "target-id": actual = context.targetId; break;
      default: return { reason: `unsupported-selector:${String((selector as { kind?: unknown }).kind)}`, unsupported: true, diagnostic: { code: "unsupported-selector" as const, message: "Unknown selector kind." } };
    }
    if (actual === undefined) return { reason: `missing-context:${selector.kind}`, unsupported: true, diagnostic: { code: "missing-context" as const, message: `Context required by ${selector.kind} is missing.` } };
    const matched = Array.isArray(actual) ? actual.some((value) => (selector.anyOf as readonly string[]).includes(value)) : (selector.anyOf as readonly string[]).includes(actual as string);
    if (!matched) return { reason: `${selector.kind}-mismatch`, unsupported: false };
  }
  return {};
}

function validNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function diag(code: EffectDiagnosticCode, message: string, instance: ActiveEffectInstance, rule: EffectRuleDefinition): EffectDiagnostic { return { code, message, instanceId: instance.id, ruleId: rule.id }; }
function groupPending(values: readonly Pending[]): Map<string, Pending[]> { const result = new Map<string, Pending[]>(); for (const value of values) { const list = result.get(value.channel) ?? []; list.push(value); result.set(value.channel, list); } return result; }
