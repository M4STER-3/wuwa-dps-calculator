import type { ActionOutcomeDefinition, FinalStats, ScaledOutcomeFormula, TalentLevel } from "./models";

export interface OutcomeAudit { scalingAttribute: ScaledOutcomeFormula["scalingAttribute"]; scalingValue: number; percent: number; flat: number; bonusPercent: number; }
export interface HealingResult { kind: "healing"; formula: "scaled-outcome-v0.1"; amount: number; target: ActionOutcomeDefinition["target"]; audit: OutcomeAudit; }
export interface ShieldResult { kind: "shield"; formula: "scaled-outcome-v0.1"; amount: number; target: ActionOutcomeDefinition["target"]; durationSeconds: number; audit: OutcomeAudit; }
export type PersonalActionOutcome = HealingResult | ShieldResult;

export function calculateActionOutcomes(definition: ActionOutcomeDefinition | undefined, level: TalentLevel, stats: FinalStats): { outcomes: readonly PersonalActionOutcome[]; diagnostics: readonly string[] } {
  if (!definition) return { outcomes: [], diagnostics: [] };
  const outcomes: PersonalActionOutcome[] = [], diagnostics: string[] = [];
  const healing = definition.healingByTalentLevel?.[level];
  if (definition.healingByTalentLevel && !healing) diagnostics.push(`missing-exact-healing-data:Lv${level}`);
  if (healing) outcomes.push({ kind: "healing", formula: "scaled-outcome-v0.1", amount: amount(healing, stats, stats.healingBonus), target: definition.target, audit: audit(healing, stats, stats.healingBonus) });
  const shield = definition.shieldByTalentLevel?.[level];
  if (definition.shieldByTalentLevel && !shield) diagnostics.push(`missing-exact-shield-data:Lv${level}`);
  if (shield) {
    if (definition.shieldDurationSeconds === undefined) diagnostics.push("missing-shield-duration");
    else outcomes.push({ kind: "shield", formula: "scaled-outcome-v0.1", amount: amount(shield, stats, 0), target: definition.target, durationSeconds: definition.shieldDurationSeconds, audit: audit(shield, stats, 0) });
  }
  return { outcomes, diagnostics };
}
function amount(f: ScaledOutcomeFormula, stats: FinalStats, bonus: number) { return (stats[f.scalingAttribute] * f.percent / 100 + f.flat) * (1 + bonus / 100); }
function audit(f: ScaledOutcomeFormula, stats: FinalStats, bonus: number): OutcomeAudit { return { scalingAttribute: f.scalingAttribute, scalingValue: stats[f.scalingAttribute], percent: f.percent, flat: f.flat, bonusPercent: bonus }; }
