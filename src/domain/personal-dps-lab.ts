import { findPersonalRotationScenario } from "@/data/personal-rotation-presets";
import { registryPersonalRotationScenarios } from "@/data/personal-dps-roster-registry";
import { mainEchoes, resonators, sonatas, weapons } from "@/data/catalog";
import { calculateActionDamage, calculateTuneRuptureDamage, type DamageTarget, type PersonalDamageResult, type StandardDamageResult, type TuneEnemyClass } from "./damage-engine";
import { resolveActiveEffects, type EffectAuditEntry } from "./effect-engine";
import type { ActiveEffectInstance, EffectDefinition } from "./effect-models";
import type { CombatAction, FinalStats, MainEcho, Resonator, Sonata, UserBuild, Weapon } from "./models";
import { loadPersonalEffects, type PersonalCombatResult, type PersonalDiagnostic } from "./personal-combat-simulation";
import { runTheoreticalPersonalRotation } from "./personal-rotation-runner";
import type { RuntimeBaseStatBasis } from "./combat-context";
import { buildEffectiveCombatStats, evaluatePredicate, evaluateValueExpression, type CombatContext } from "./combat-context";
import { calculateActionOutcomes, type PersonalActionOutcome } from "./action-outcome-engine";
import { resolveActionTalentLevel } from "./talent-engine";
import type { RuntimeStatModifier } from "./effect-models";
import { applyMotionValueModifiers } from "./motion-value-engine";

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

export interface ActionLabResult { action: CombatAction; damage: PersonalDamageResult; outcomes: readonly PersonalActionOutcome[]; effectAudit: readonly EffectAuditEntry[]; activeEffectIds: readonly string[]; diagnostics: readonly LoadoutDiagnostic[]; partial: boolean; }
export function calculateActionLab(input: { loadout: ResolvedPersonalLoadout; actionId: string; stats: FinalStats; target: LabTarget; manualEffectIds?: readonly string[]; resonanceMode?: string; }): ActionLabResult | undefined {
  const baseAction = input.loadout.actions.find((item) => item.id === input.actionId);
  const resonator = input.loadout.resonator;
  if (!baseAction || !resonator) return undefined;
  const requestedLevel = input.loadout.build.skillLevels[baseAction.talent as keyof typeof input.loadout.build.skillLevels] ?? baseAction.level;
  const talent = resolveActionTalentLevel(baseAction, requestedLevel);
  const action = talent.status === "supported" ? talent.action : baseAction;
  const selected = new Set(input.manualEffectIds ?? []);
  const active: ActiveEffectInstance[] = input.loadout.effects.filter((definition) => selected.has(definition.id)).map((definition) => ({ id: `manual:${definition.id}`, definition, ownerId: resonator.id }));
  const effectiveType = action.damageType === "tuneRupture" ? undefined : action.damageType;
  const legacyActive=active.map(instance=>({...instance,definition:{...instance.definition,rules:instance.definition.rules.map(rule=>({...rule,modifiers:rule.modifiers.filter(modifier=>!["runtime-stat","motion-value","action-replacement","damage-type-replacement"].includes(modifier.kind)) as typeof rule.modifiers}))}}));
  const effects = resolveActiveEffects(legacyActive, { actorId: resonator.id, targetId: input.target.id, teamMemberIds: [resonator.id], element: resonator.element, damageType: effectiveType, resonanceMode: input.resonanceMode, actionId: action.id });
  const context:CombatContext={timestamp:0,actorId:resonator.id,ownerId:resonator.id,targetId:input.target.id,panelStats:input.stats,element:resonator.element,damageType:effectiveType,actionId:action.id,resonanceMode:input.resonanceMode};
  const applies=(rule:EffectDefinition["rules"][number])=>(rule.predicates??[]).every(predicate=>evaluatePredicate(predicate,context).status==="matched")&&(rule.selectors??[]).every(selector=>selector.kind==="action-id"?selector.anyOf.includes(action.id):selector.kind==="damage-type"?effectiveType!==undefined&&selector.anyOf.includes(effectiveType):selector.kind==="element"?selector.anyOf.includes(resonator.element):selector.kind==="owner-id"?selector.anyOf.includes(resonator.id):true);
  const runtime = active.flatMap((instance) => instance.definition.rules.flatMap((rule) => rule.accounting === "runtime"&&applies(rule) ? rule.modifiers.flatMap((modifier) => {
    if (modifier.kind !== "runtime-stat") return [];
    const value = evaluateValueExpression((modifier as RuntimeStatModifier).value, context);
    return value.status === "supported" ? [{stat:modifier.stat,mode:modifier.mode,value:value.value!}] : [];
  }) : []));
  const effective = buildEffectiveCombatStats(input.stats, input.loadout.baseStatBasis ?? {}, runtime);
  const mv=active.flatMap(instance=>instance.definition.rules.flatMap(rule=>rule.accounting==="runtime"&&applies(rule)?rule.modifiers.flatMap(modifier=>{if(modifier.kind!=="motion-value")return[];const value=evaluateValueExpression(modifier.value,context);return value.status==="supported"?[{mode:modifier.mode,value:value.value!,groupDistribution:modifier.groupDistribution}]:[];}):[]));
  const mvResult=applyMotionValueModifiers(action.multipliers,mv),effectiveAction=mvResult.status==="supported"?{...action,multipliers:mvResult.groups}:action,effectiveStats=effective.status === "supported" ? effective.stats : input.stats;
  const damage: PersonalDamageResult = talent.status === "unsupported" ? { status:"unsupported",actionId:action.id,actionName:action.name,reason:"missing-exact-talent-data",message:talent.message } : action.damageType === "tuneRupture"
    ? calculateTuneRuptureDamage({ action:effectiveAction, finalStats: effectiveStats, attackerLevel: input.loadout.build.characterLevel, enemyClass: input.target.tuneEnemyClass, element: resonator.element, target: input.target, modifiers: effects.tuneDamageModifiers, critOverride: effects.overrides.fixedCrit, context: input.resonanceMode ? { resonanceMode: input.resonanceMode } : undefined })
    : calculateActionDamage({ action:effectiveAction, finalStats: effectiveStats, attackerLevel: input.loadout.build.characterLevel, scalingAttribute: action.scalingAttribute ?? "attack", element: resonator.element, target: input.target, modifiers: effects.damageModifiers });
  const outcomeResult = talent.status === "supported" ? calculateActionOutcomes(action.outcomes, action.level, effectiveStats) : {outcomes:[],diagnostics:[]};
  const structuredKinds=new Set(action.resourceOperations?.map(operation=>operation.operation));const legacyUnstructured=(action.costs?.length&&!structuredKinds.has("consume"))||(action.gains?.length&&!structuredKinds.has("gain"));
  const diagnostics = [...input.loadout.diagnostics, ...effects.diagnostics.map((item) => ({ code: item.code, message: item.message })), ...(talent.status === "unsupported" ? [{code:talent.reason,message:talent.message}] : []), ...outcomeResult.diagnostics.map(message=>({code:message.split(":")[0],message})), ...(legacyUnstructured?[{code:"unstructured-action-resource-change",message:`${action.id} has a verified quantity without an exact executable stage.`}]:[])];
  return { action, damage, outcomes: outcomeResult.outcomes, effectAudit: effects.audit, activeEffectIds: [...selected], diagnostics, partial: damage.status === "unsupported" || diagnostics.length > 0 };
}

export function simulateRotationLab(loadout: ResolvedPersonalLoadout, stats: FinalStats, target: LabTarget, resonanceMode?: string): PersonalCombatResult | undefined {
  if (!loadout.resonator) return undefined;
  const scenario =
    findPersonalRotationScenario(loadout.resonator.id, resonanceMode) ??
    registryPersonalRotationScenarios.find(
      (candidate) => candidate.resonatorId === loadout.resonator!.id,
    );
  if (!scenario) return undefined;
  return runTheoreticalPersonalRotation({
    scenario,
    resonator: loadout.resonator,
    build: loadout.build,
    stats,
    target,
    weapon: loadout.weapon,
    sonata: loadout.sonata,
    mainEcho: loadout.mainEcho,
    actions: loadout.actions,
    baseStatBasis: loadout.baseStatBasis,
    resonanceMode,
  }).simulation;
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
