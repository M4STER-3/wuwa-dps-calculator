import type { DamageType } from "./damage-engine";
import type { CombatPredicate, RuntimeStat, ValueExpression } from "./effect-models";
import type { Element, FinalStats } from "./models";

export interface RuntimeBaseStatBasis { attack?: number; hp?: number; defense?: number; provenance?: string; }
export interface ResourceView { current: number; max: number; }
export interface CombatContext {
  timestamp: number; actorId: string; ownerId: string; targetId: string;
  sourceId?: string; damageOwnerId?: string; scalingOwnerId?: string; triggeringActorId?: string;
  sourceEntityId?: string; actionId?: string; actionCategories?: readonly string[];
  damageType?: DamageType; element?: Element; resonanceMode?: string; form?: string;
  eventKind?: string; eventSourceId?: string; eventTargetId?: string;
  actorHpRatio?: number; targetHpRatio?: number; onField?: boolean; shieldActive?: boolean;
  panelStats: FinalStats; effectiveStats?: Readonly<Record<string, number>>;
  resources?: Readonly<Record<string, ResourceView>>; activeEffectIds?: readonly string[];
  states?: readonly string[]; statuses?: Readonly<Record<string, number>>;
  targetStatuses?: Readonly<Record<string, number>>; domains?: readonly string[];
}
export interface ExpressionDiagnostic { code: "missing-variable" | "missing-rank-value" | "invalid-expression" | "dependency-cycle"; message: string; path: string; }
export interface ExpressionResult { status: "supported" | "unsupported"; value?: number; audit: readonly string[]; diagnostics: readonly ExpressionDiagnostic[]; }

export function evaluateValueExpression(expression: ValueExpression, context: CombatContext, options: { stacks?: number; rank?: number; path?: readonly string[] } = {}): ExpressionResult {
  const audit: string[] = [], diagnostics: ExpressionDiagnostic[] = [];
  const visit = (node: ValueExpression, trail: readonly ValueExpression[]): number | undefined => {
    if (trail.includes(node)) { diagnostics.push({ code: "dependency-cycle", message: "Circular value expression.", path: options.path?.join(".") ?? "value" }); return; }
    const next = [...trail, node]; let value: number | undefined;
    switch (node.kind) {
      case "constant": value = node.value; break;
      case "stacks": value = options.stacks; break;
      case "rank": value = options.rank === undefined ? undefined : node.values[options.rank]; if (value === undefined) diagnostics.push({ code: "missing-rank-value", message: `No exact value for rank ${String(options.rank)}.`, path: "rank" }); break;
      case "stat": value = (node.view === "effective" ? context.effectiveStats : context.panelStats)?.[node.stat as keyof FinalStats] as number | undefined; break;
      case "resource": value = context.resources?.[`${node.ownerId ?? context.ownerId}:${node.resourceId}`]?.current ?? context.resources?.[node.resourceId]?.current; break;
      case "add": case "multiply": case "min": case "max": { const values = node.values.map(v => visit(v, next)); if (values.some(v => v === undefined)) break; const xs = values as number[]; value = node.kind === "add" ? xs.reduce((a,b)=>a+b,0) : node.kind === "multiply" ? xs.reduce((a,b)=>a*b,1) : node.kind === "min" ? Math.min(...xs) : Math.max(...xs); break; }
      case "subtract": { const left=visit(node.left,next), right=visit(node.right,next); if(left!==undefined&&right!==undefined)value=left-right; break; }
      case "clamp": { const x=visit(node.value,next); if(x!==undefined)value=Math.min(node.max,Math.max(node.min,x)); break; }
      case "cap": { const x=visit(node.value,next); if(x!==undefined)value=Math.min(node.max,x); break; }
      case "stack-threshold": value=(options.stacks??0)>=node.threshold?visit(node.then,next):node.otherwise?visit(node.otherwise,next):0; break;
    }
    if (value === undefined && diagnostics.length === 0) diagnostics.push({ code: "missing-variable", message: `Missing value for ${node.kind}.`, path: node.kind });
    if (value !== undefined && !Number.isFinite(value)) { diagnostics.push({ code: "invalid-expression", message: "Expression produced a non-finite value.", path: node.kind }); return; }
    if(value!==undefined)audit.push(`${node.kind}=${value}`); return value;
  };
  const value=visit(expression,[]); return { status:value===undefined?"unsupported":"supported", value, audit, diagnostics };
}

export interface PredicateResult { status: "matched" | "ignored" | "unsupported"; reason: string; }
export function evaluatePredicate(p: CombatPredicate, c: CombatContext): PredicateResult {
  if(p.kind==="and"||p.kind==="or"){const rs=p.predicates.map(x=>evaluatePredicate(x,c));if(rs.some(r=>r.status==="unsupported"))return{status:"unsupported",reason:"nested-predicate-unsupported"};const ok=p.kind==="and"?rs.every(r=>r.status==="matched"):rs.some(r=>r.status==="matched");return{status:ok?"matched":"ignored",reason:p.kind};}
  if(p.kind==="not"){const r=evaluatePredicate(p.predicate,c);return r.status==="unsupported"?r:{status:r.status==="matched"?"ignored":"matched",reason:"not"};}
  let actual: unknown;
  if(p.kind==="identity")actual=c[p.field as keyof CombatContext];
  else if(p.kind==="action-category")actual=c.actionCategories;
  else if(p.kind==="number")actual=c[p.field];
  else if(p.kind==="stat")actual=(c.effectiveStats??c.panelStats)[p.stat as keyof FinalStats];
  else if(p.kind==="resource")actual=c.resources?.[p.resourceId];
  else if(p.kind==="has-effect")actual=c.activeEffectIds?.includes(p.id);
  else if(p.kind==="state-active")actual=c.states?.includes(p.id);
  else if(p.kind==="has-status")actual=c.statuses?.[p.id]??0;
  else if(p.kind==="target-has-status")actual=c.targetStatuses?.[p.id]??0;
  else if(p.kind==="shield-active")actual=c.shieldActive;
  else if(p.kind==="on-field")actual=c.onField;
  else if(p.kind==="inside-domain")actual=c.domains?.includes(p.domainId);
  if(actual===undefined)return{status:"unsupported",reason:"missing-context"};
  let ok=false;
  if(p.kind==="identity")ok=p.anyOf.includes(String(actual));
  else if(p.kind==="action-category")ok=(actual as readonly string[]).some(x=>p.anyOf.includes(x));
  else if(p.kind==="number"){const n=actual as number;ok=p.comparison==="eq"?n===p.value:p.comparison==="gte"?n>=p.value:n<=p.value;}
  else if(p.kind==="stat"){const v=evaluateValueExpression(p.value,c);if(v.status==="unsupported")return{status:"unsupported",reason:"predicate-value-unsupported"};ok=p.comparison==="eq"?actual===v.value:p.comparison==="gte"?(actual as number)>=v.value!:(actual as number)<=v.value!;}
  else if(p.kind==="resource"){const r=actual as ResourceView;if(p.comparison==="max")ok=r.current===r.max;else if(p.comparison==="available")ok=r.current>0;else{const v=p.value&&evaluateValueExpression(p.value,c);if(!v||v.status==="unsupported")return{status:"unsupported",reason:"predicate-value-unsupported"};ok=p.comparison==="eq"?r.current===v.value:p.comparison==="gte"?r.current>=v.value!:r.current<=v.value!;}}
  else if(p.kind==="has-status"||p.kind==="target-has-status")ok=(actual as number)>=(p.minStacks??1);
  else if(p.kind==="has-effect"||p.kind==="state-active"||p.kind==="shield-active"||p.kind==="inside-domain")ok=Boolean(actual);
  else if(p.kind==="on-field")ok=actual===p.value;
  return{status:ok?"matched":"ignored",reason:ok?"predicate-matched":"predicate-false"};
}

export interface EffectiveStatAudit { stat: RuntimeStat; panel: number; basis?: number; percent: number; percentContribution: number; flatContribution: number; effective: number; }
export function buildEffectiveCombatStats(panel: FinalStats, basis: RuntimeBaseStatBasis, modifiers: readonly {stat:RuntimeStat;mode:"percent"|"flat";value:number}[]): {status:"supported"|"unsupported";stats:FinalStats;audit:readonly EffectiveStatAudit[];diagnostics:readonly string[]} {
  const stats:FinalStats={...panel,elementalDamageBonus:{...panel.elementalDamageBonus},damageTypeBonus:{...panel.damageTypeBonus}}, audit:EffectiveStatAudit[]=[], diagnostics:string[]=[];
  for(const stat of new Set(modifiers.map(m=>m.stat))){const panelValue=(panel as unknown as Record<string,number>)[stat];if(!Number.isFinite(panelValue)){diagnostics.push(`unsupported-runtime-stat:${stat}`);continue;}const percent=modifiers.filter(m=>m.stat===stat&&m.mode==="percent").reduce((s,m)=>s+m.value,0);const flat=modifiers.filter(m=>m.stat===stat&&m.mode==="flat").reduce((s,m)=>s+m.value,0);const b=(basis as Record<string,number|undefined>)[stat];if(percent!==0&&b===undefined){diagnostics.push(`missing-base-stat-basis:${stat}`);continue;}const pc=(b??0)*percent/100,effective=panelValue+pc+flat;(stats as unknown as Record<string,number>)[stat]=effective;audit.push({stat,panel:panelValue,basis:b,percent,percentContribution:pc,flatContribution:flat,effective});}
  return{status:diagnostics.length?"unsupported":"supported",stats,audit,diagnostics};
}
