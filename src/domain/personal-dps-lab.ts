import { aemeathTemporalTimeline } from "@/data/aemeath-temporal";
import { mainEchoes, resonators, sonatas, weapons } from "@/data/catalog";
import { calculateActionDamage, calculateTuneRuptureDamage, type DamageTarget, type PersonalDamageResult, type StandardDamageResult, type TuneEnemyClass } from "./damage-engine";
import { resolveActiveEffects, type EffectAuditEntry } from "./effect-engine";
import type { ActiveEffectInstance, EffectDefinition } from "./effect-models";
import type { CombatAction, FinalStats, MainEcho, Resonator, Sonata, UserBuild, Weapon } from "./models";
import { loadPersonalEffects, simulatePersonalCombat, type PersonalCombatResult, type PersonalDiagnostic } from "./personal-combat-simulation";
import type { RuntimeBaseStatBasis } from "./combat-context";

export interface LoadoutDiagnostic { code: string; message: string; }
export interface ResolvedPersonalLoadout {
  build: UserBuild; resonator?: Resonator; weapon?: Weapon; sonata?: Sonata; mainEcho?: MainEcho;
  actions: readonly CombatAction[]; effects: readonly EffectDefinition[]; baseStatBasis?: RuntimeBaseStatBasis;
  diagnostics: readonly LoadoutDiagnostic[]; supported: boolean;
}

export function resolvePersonalLoadout(build: UserBuild): ResolvedPersonalLoadout {
  const diagnostics: LoadoutDiagnostic[] = [];
  const resonator = resonators.find((item) => item.id === build.resonatorId);
  const weapon = weapons.find((item) => item.id === build.weapon.weaponId);
  const sonata = build.sonataId ? sonatas.find((item) => item.id === build.sonataId) : undefined;
  const mainEcho = build.mainEchoId ? mainEchoes.find((item) => item.id === build.mainEchoId) : undefined;
  if (!resonator) diagnostics.push({ code: "unresolved-resonator-id", message: `Unknown Resonator id: ${build.resonatorId}.` });
  if (!weapon) diagnostics.push({ code: "unresolved-weapon-id", message: `Unknown weapon id: ${build.weapon.weaponId}.` });
  if (build.sonataId && !sonata) diagnostics.push({ code: "unresolved-sonata-id", message: `Unknown Sonata id: ${build.sonataId}.` });
  if (build.mainEchoId && !mainEcho) diagnostics.push({ code: "unresolved-main-echo-id", message: `Unknown Main Echo id: ${build.mainEchoId}.` });
  const characterBase = resonator?.baseStats?.find((item) => item.level === build.characterLevel);
  const exactWeapon = build.weapon.level === 90 ? weapon?.level90Stats : undefined;
  const baseStatBasis = characterBase && exactWeapon
    ? { attack: characterBase.attack + exactWeapon.baseAttack, hp: characterBase.hp, defense: characterBase.defense }
    : undefined;
  if (!baseStatBasis) diagnostics.push({ code: "missing-base-stat-basis", message: "Exact character and weapon base stats are unavailable at the selected levels; runtime percent stats cannot be applied." });
  const actions = [...(resonator?.combat?.actions ?? []), ...(mainEcho?.action ? [mainEcho.action] : [])];
  const loaded = resonator ? loadPersonalEffects(resonator, build.sequence, { weapon, sonata, mainEcho }) : { definitions: [], diagnostics: [] };
  diagnostics.push(...loaded.diagnostics.map(({ code, message }) => ({ code, message })));
  return { build, resonator, weapon, sonata, mainEcho, actions, effects: loaded.definitions, baseStatBasis, diagnostics, supported: Boolean(resonator && weapon && actions.length) };
}

export interface LabTarget extends DamageTarget { id: string; tuneEnemyClass: TuneEnemyClass; }
export const DEFAULT_LAB_TARGET: LabTarget = { id: "training-target", level: 90, physicalResistance: 0.1, elementalResistance: { aero: 0.1, glacio: 0.1, electro: 0.1, fusion: 0.1, havoc: 0.1, spectro: 0.1 }, tuneEnemyClass: "4C" };

export interface ActionLabResult { action: CombatAction; damage: PersonalDamageResult; effectAudit: readonly EffectAuditEntry[]; activeEffectIds: readonly string[]; diagnostics: readonly LoadoutDiagnostic[]; partial: boolean; }
export function calculateActionLab(input: { loadout: ResolvedPersonalLoadout; actionId: string; stats: FinalStats; target: LabTarget; manualEffectIds?: readonly string[]; resonanceMode?: string; }): ActionLabResult | undefined {
  const action = input.loadout.actions.find((item) => item.id === input.actionId);
  const resonator = input.loadout.resonator;
  if (!action || !resonator) return undefined;
  const selected = new Set(input.manualEffectIds ?? []);
  const active: ActiveEffectInstance[] = input.loadout.effects.filter((definition) => selected.has(definition.id)).map((definition) => ({ id: `manual:${definition.id}`, definition, ownerId: resonator.id }));
  const effectiveType = action.damageType === "tuneRupture" ? undefined : action.damageType;
  const effects = resolveActiveEffects(active, { actorId: resonator.id, targetId: input.target.id, teamMemberIds: [resonator.id], element: resonator.element, damageType: effectiveType, resonanceMode: input.resonanceMode, actionId: action.id });
  const damage = action.damageType === "tuneRupture"
    ? calculateTuneRuptureDamage({ action, finalStats: input.stats, attackerLevel: input.loadout.build.characterLevel, enemyClass: input.target.tuneEnemyClass, element: resonator.element, target: input.target, modifiers: effects.tuneDamageModifiers, critOverride: effects.overrides.fixedCrit, context: input.resonanceMode ? { resonanceMode: input.resonanceMode } : undefined })
    : calculateActionDamage({ action, finalStats: input.stats, attackerLevel: input.loadout.build.characterLevel, scalingAttribute: "attack", element: resonator.element, target: input.target, modifiers: effects.damageModifiers });
  const diagnostics = [...input.loadout.diagnostics, ...effects.diagnostics.map((item) => ({ code: item.code, message: item.message }))];
  return { action, damage, effectAudit: effects.audit, activeEffectIds: [...selected], diagnostics, partial: damage.status === "unsupported" || diagnostics.length > 0 };
}

export function simulateRotationLab(loadout: ResolvedPersonalLoadout, stats: FinalStats, target: LabTarget, resonanceMode?: string): PersonalCombatResult | undefined {
  if (!loadout.resonator) return undefined;
  const build = { ...loadout.build, finalStats: stats };
  return simulatePersonalCombat({ resonator: loadout.resonator, build, timeline: aemeathTemporalTimeline, target, resonanceMode, baseStatBasis: loadout.baseStatBasis, loadout: { weapon: loadout.weapon, sonata: loadout.sonata, mainEcho: loadout.mainEcho } });
}

export interface ValidationDelta { calculated: number; observed: number; absoluteDelta: number; percentageDelta: number | null; }
export function compareObservedDamage(calculated: number, observed: number): ValidationDelta {
  return { calculated, observed, absoluteDelta: calculated - observed, percentageDelta: observed === 0 ? null : ((calculated - observed) / observed) * 100 };
}

export function diagnosticsByFamily(diagnostics: readonly (LoadoutDiagnostic | PersonalDiagnostic)[]) {
  const family = (code: string) => code.includes("base-stat") ? "base stat missing" : code.includes("timing") ? "missing hit timing" : code.includes("formula") ? "unsupported formula" : code.includes("resource") ? "unresolved resource" : code.includes("state") || code.includes("condition") ? "unresolved state" : code.includes("talent") || code.includes("rank") ? "talent/rank missing" : code.includes("external") ? "external context required" : "missing data";
  return diagnostics.reduce<Record<string, (LoadoutDiagnostic | PersonalDiagnostic)[]>>((groups, item) => {
    (groups[family(item.code)] ??= []).push(item); return groups;
  }, {});
}

export function isStandardDamage(result: PersonalDamageResult): result is StandardDamageResult { return result.status === "supported" && result.formula === "standard-damage-v0.1"; }
