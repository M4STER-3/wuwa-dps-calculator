import type { MotionValueGroup } from "./models";

export interface ResolvedMotionValueModifier { mode: "additive-percent" | "relative-additive" | "multiplier"; value: number; groupDistribution?: readonly { groupIndex: number; weight: number }[]; }
export type MotionValueResolution = { status:"supported"; groups:readonly MotionValueGroup[] } | { status:"unsupported"; reason:"invalid-group-distribution" };

/** Applies generic MV-layer modifiers without knowing action or Resonator ids. */
export function applyMotionValueModifiers(groups: readonly MotionValueGroup[], modifiers: readonly ResolvedMotionValueModifier[]): MotionValueResolution {
  let next = groups.map(group=>({...group}));
  for (const modifier of modifiers) {
    if (!Number.isFinite(modifier.value)) return {status:"unsupported",reason:"invalid-group-distribution"};
    if (modifier.mode === "multiplier") { next=next.map(group=>({...group,percent:group.percent*modifier.value/100})); continue; }
    if (modifier.mode === "relative-additive") { next=next.map((group,index)=>({...group,percent:group.percent+groups[index].percent*modifier.value/100})); continue; }
    if (modifier.groupDistribution) {
      const sum=modifier.groupDistribution.reduce((total,item)=>total+item.weight,0);
      if (Math.abs(sum-1)>1e-9||modifier.groupDistribution.some(item=>!Number.isInteger(item.groupIndex)||item.groupIndex<0||item.groupIndex>=next.length||!Number.isFinite(item.weight)||item.weight<0)) return {status:"unsupported",reason:"invalid-group-distribution"};
      next=next.map((group,index)=>{const share=modifier.groupDistribution!.filter(item=>item.groupIndex===index).reduce((total,item)=>total+item.weight,0);return{...group,percent:group.percent+(share*modifier.value/group.hits)};});
    } else {
      const original=next.reduce((sum,group)=>sum+group.percent*group.hits,0);
      if (original!==0) next=next.map(group=>({...group,percent:group.percent*(original+modifier.value)/original}));
    }
  }
  return {status:"supported",groups:next};
}
