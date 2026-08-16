import { buildEffectiveCombatStats, evaluatePredicate, evaluateValueExpression, type CombatContext, type RuntimeBaseStatBasis } from "./combat-context";
import { resolveActiveEffects, type EffectResolutionResult } from "./effect-engine";
import type { ActiveEffectInstance, RuntimeStatModifier } from "./effect-models";
import { applyMotionValueModifiers } from "./motion-value-engine";
import type { CombatAction, FinalStats } from "./models";
import type { DamageType } from "./damage-engine";

export interface UniversalActionPipelineInput {
  action: CombatAction;
  actionsById: Readonly<Record<string, CombatAction>>;
  effects: readonly ActiveEffectInstance[];
  context: CombatContext;
  finalStats: FinalStats;
  baseStatBasis?: RuntimeBaseStatBasis;
  sequence: number;
  teamMemberIds: readonly string[];
}
export type UniversalActionPipelineResult =
  | { status: "supported"; action: CombatAction; finalStats: FinalStats; damageType?: DamageType; effects: EffectResolutionResult }
  | { status: "unsupported"; code: string; message: string };

export function resolveUniversalActionReplacement(action:CombatAction,actionsById:Readonly<Record<string,CombatAction>>,effects:readonly ActiveEffectInstance[],context:CombatContext,sequence:number):{status:"supported";action:CombatAction}|{status:"unsupported";code:string;message:string}{let current=action;for(const instance of effects)for(const rule of instance.definition.rules){if((rule.requiredSequence??0)>sequence)continue;for(const modifier of rule.modifiers)if(modifier.kind==="action-replacement"&&modifier.actionId===current.id){const predicate=evaluatePredicate(modifier.condition,{...context,actionId:current.id});if(predicate.status==="unsupported")return{status:"unsupported",code:"requirement-context-required",message:`Action replacement context is missing for ${current.id}.`};if(predicate.status==="matched"){const replacement=actionsById[modifier.replacementActionId];if(!replacement)return{status:"unsupported",code:"unknown-action",message:`Replacement ${modifier.replacementActionId} is missing.`};current=replacement;}}}return{status:"supported",action:current};}

/** Shared closed-data action/modifier pipeline; formulas remain in Damage Engine. */
export function resolveUniversalActionPipeline(input: UniversalActionPipelineInput): UniversalActionPipelineResult {
  const replacement=resolveUniversalActionReplacement(input.action,input.actionsById,input.effects,input.context,input.sequence);if(replacement.status==="unsupported")return replacement;let action=replacement.action;
  let damageType = action.damageType && action.damageType !== "tuneRupture" ? action.damageType : undefined;
  const runtime: Array<{stat:RuntimeStatModifier["stat"];mode:RuntimeStatModifier["mode"];value:number}> = [];
  const motion: Array<{mode:"additive-percent"|"relative-additive"|"multiplier";value:number;effectId:string;groupDistribution?:readonly{groupIndex:number;weight:number}[]}> = [];
  const context = { ...input.context, actionId: action.id, damageType };
  for (const instance of input.effects) for (const rule of instance.definition.rules) {
    if (rule.accounting !== "runtime" || (rule.requiredSequence ?? 0) > input.sequence) continue;
    const predicates = (rule.predicates ?? []).map((predicate) => evaluatePredicate(predicate, context));
    if (predicates.some((result) => result.status === "unsupported")) return { status:"unsupported",code:"modifier-context-required",message:`Modifier context is missing for ${rule.id}.` };
    if (predicates.some((result) => result.status === "ignored")) continue;
    for (const modifier of rule.modifiers) {
      if (modifier.kind === "damage-type-replacement") {
        const result = evaluatePredicate(modifier.condition, context);
        if (result.status === "unsupported") return { status:"unsupported",code:"modifier-context-required",message:`Damage type replacement context is missing for ${rule.id}.` };
        if (result.status === "matched") damageType = modifier.damageType;
      } else if (modifier.kind === "runtime-stat" || modifier.kind === "motion-value") {
        const value = evaluateValueExpression(modifier.value, context, { stacks: instance.stacks, rank: instance.rank });
        if (value.status === "unsupported") return { status:"unsupported",code:value.diagnostics[0]?.code??"modifier-context-required",message:value.diagnostics[0]?.message??`Modifier ${rule.id} is unsupported.` };
        if (modifier.kind === "runtime-stat") runtime.push({stat:modifier.stat,mode:modifier.mode,value:value.value!});
        else motion.push({mode:modifier.mode,value:value.value!,effectId:instance.definition.id,groupDistribution:modifier.groupDistribution});
      }
    }
  }
  const stats = buildEffectiveCombatStats(input.finalStats, input.baseStatBasis ?? {}, runtime);
  if (stats.status === "unsupported") return {status:"unsupported",code:stats.diagnostics[0]?.split(":")[0]??"runtime-stat-unsupported",message:stats.diagnostics.join(", ")};
  const motionResult = applyMotionValueModifiers(action.multipliers, motion);
  if (motionResult.status === "unsupported") return {status:"unsupported",code:motionResult.reason,message:`Motion Value modifiers are unsupported for ${action.id}.`};
  action = { ...action, multipliers: motionResult.groups };
  const damageEffects=input.effects.map(instance=>({...instance,definition:{...instance.definition,rules:instance.definition.rules.map(rule=>({...rule,modifiers:rule.modifiers.filter(modifier=>!["runtime-stat","motion-value","action-replacement","damage-type-replacement"].includes(modifier.kind))}))}}));
  const effects = resolveActiveEffects(damageEffects,{actorId:input.context.actorId,targetId:input.context.targetId,teamMemberIds:input.teamMemberIds,element:input.context.element,damageType,actionId:action.id,combatContext:{...context,effectiveStats:stats.stats as unknown as Readonly<Record<string,number>>}});
  if (effects.diagnostics.length) return {status:"unsupported",code:effects.diagnostics[0].code,message:effects.diagnostics[0].message};
  if (effects.overrides.fixedCrit) {
    stats.stats.critRate = effects.overrides.fixedCrit.critRatePercent;
    stats.stats.critDamage = effects.overrides.fixedCrit.critDamagePercent;
  }
  return {status:"supported",action,finalStats:stats.stats,damageType,effects};
}
