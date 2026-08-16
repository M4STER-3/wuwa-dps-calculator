import {
  calculateActionDamage,
  type AemeathResonanceMode,
  type DamageAmounts,
  type DamageTarget,
  type ScalingAttribute,
  type StandardDamageResult,
  type TuneEnemyClass,
} from "./damage-engine";
import type { CombatAction, Resonator, UserBuild } from "./models";
import type {
  TemporalConfidence,
  TemporalEffectWindow,
  TemporalTimeline,
  TimelineEntry,
} from "./temporal-engine";

export type CombatStepStatus =
  | "calculated"
  | "no-damage"
  | "unsupported-damage"
  | "unmapped-action";

export type CombatStepReason =
  | "zero-motion-value"
  | "no-action-associated"
  | "conditional-damage-context-unresolved"
  | "action-not-found"
  | "damage-engine-unsupported";

export interface CombatSimulationDiagnostic {
  code:
    | "conditional-damage-context-unresolved"
    | "action-not-found"
    | "rotation-prerequisites-not-validated"
    | "sequence-effects-not-applied";
  severity: "information" | "warning";
  stepId?: string;
  actionId?: string;
  message: string;
}

export interface UnmodeledMechanic {
  id: string;
  state: "not-simulated" | "not-emitted";
  formulaSupport: "available" | "not-available" | "not-applicable";
  mode?: AemeathResonanceMode;
  description: string;
}

export interface CombatStepResult {
  index: number;
  stepId: string;
  actionId?: string;
  actionName?: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  effectiveDurationSeconds: number;
  temporalConfidence: TemporalConfidence;
  temporalNotes: readonly string[];
  hitTimingsSeconds: readonly number[] | null;
  status: CombatStepStatus;
  reason?: CombatStepReason;
  reasonDetails?: string;
  damage?: StandardDamageResult;
}

export interface CombatSimulationRequest {
  resonator: Resonator;
  build: UserBuild;
  resonanceMode: AemeathResonanceMode;
  timeline: TemporalTimeline;
  target: DamageTarget & { tuneEnemyClass?: TuneEnemyClass };
  /** Character integration policy; Aemeath V0.1 supplies `attack`. */
  scalingAttribute: ScalingAttribute;
  temporalEffectWindows?: readonly TemporalEffectWindow[];
}

export interface CombatSimulationResult {
  version: "combat-simulation-v0.1";
  resonator: { id: string; name: string; element: Resonator["element"] };
  build: { id: string; level: number; sequence: UserBuild["sequence"] };
  resonanceMode: AemeathResonanceMode;
  rotationId: string;
  rotationDurationSeconds: number;
  temporalConfidence: TemporalConfidence;
  calibrationFactor: number | null;
  target: CombatSimulationRequest["target"];
  partial: true;
  stepResults: readonly CombatStepResult[];
  supportedDamage: DamageAmounts;
  supportedDps: DamageAmounts;
  counts: Record<CombatStepStatus | "total", number>;
  diagnostics: readonly CombatSimulationDiagnostic[];
  unmodeledMechanics: readonly UnmodeledMechanic[];
  temporalEffectWindows: readonly TemporalEffectWindow[];
}

const ZERO: DamageAmounts = { nonCrit: 0, crit: 0, expected: 0 };

function stepBase(entry: TimelineEntry) {
  return {
    index: entry.index,
    stepId: entry.stepId,
    actionId: entry.actionId,
    startTimeSeconds: entry.startTimeSeconds,
    endTimeSeconds: entry.endTimeSeconds,
    effectiveDurationSeconds: entry.effectiveDurationSeconds,
    temporalConfidence: entry.confidence,
    temporalNotes: entry.notes,
    hitTimingsSeconds: entry.hitTimingsSeconds,
  };
}

function mechanics(mode: AemeathResonanceMode): UnmodeledMechanic[] {
  const common: UnmodeledMechanic[] = [
    { id: "resource-legality", state: "not-simulated", formulaSupport: "not-applicable", description: "La légalité des ressources, états, coûts et formes n'est pas validée." },
    { id: "real-hit-timings", state: "not-simulated", formulaSupport: "not-applicable", description: "Les timestamps réels des hits sont inconnus et ne sont pas inventés." },
    { id: "equipment-conditional-effects", state: "not-simulated", formulaSupport: "not-applicable", description: "Les effets conditionnels d'équipement ne sont pas appliqués." },
    { id: "sonata-conditional-effects", state: "not-simulated", formulaSupport: "not-applicable", description: "Les effets conditionnels de Sonata ne sont pas appliqués." },
    { id: "sigillum-echo-damage", state: "not-emitted", formulaSupport: "available", description: "Sigillum et les dégâts Echo ne sont pas insérés dans la rotation." },
    { id: "before-all-sounds", state: "not-simulated", formulaSupport: "not-applicable", description: "Before All Sounds et son amplification conditionnelle ne sont pas résolus." },
    { id: "between-the-stars", state: "not-simulated", formulaSupport: "not-applicable", description: "Between the Stars et ses contributeurs ne sont pas résolus." },
    { id: "fusion-burst-damage", state: "not-emitted", formulaSupport: "not-available", mode: "fusion-burst", description: "Les dégâts spécifiques Fusion Burst ne sont ni inventés ni émis." },
  ];
  if (mode === "tune-rupture") {
    common.push(
      { id: "automatic-starburst", state: "not-emitted", formulaSupport: "available", mode, description: "La formule Starburst est disponible, mais son trigger automatique n'est pas simulé." },
      { id: "seraphic-tune-rupture-bonus", state: "not-emitted", formulaSupport: "available", mode, description: "Les instances bonus Tune Rupture de Seraphic Duet ne sont pas émises." },
      { id: "rupturous-trail-lifecycle", state: "not-simulated", formulaSupport: "not-applicable", mode, description: "Le cycle de vie de Rupturous Trail n'est pas simulé." },
      { id: "starburst-target-icd", state: "not-simulated", formulaSupport: "not-applicable", mode, description: "L'ICD Starburst par cible n'est pas exécuté." },
    );
  }
  return common;
}

export function simulateCombat(request: CombatSimulationRequest): CombatSimulationResult {
  const actions = new Map(
    (request.resonator.combat?.actions ?? []).map((action) => [action.id, action]),
  );
  const diagnostics: CombatSimulationDiagnostic[] = [];
  const totals = { ...ZERO };

  const stepResults = request.timeline.entries.map((entry): CombatStepResult => {
    const base = stepBase(entry);
    if (!entry.actionId) {
      return { ...base, status: "no-damage", reason: "no-action-associated" };
    }
    const action: CombatAction | undefined = actions.get(entry.actionId);
    if (!action) {
      diagnostics.push({ code: "action-not-found", severity: "warning", stepId: entry.stepId, actionId: entry.actionId, message: `L'action ${entry.actionId} référencée par la timeline est introuvable.` });
      return { ...base, status: "unmapped-action", reason: "action-not-found" };
    }
    const named = { ...base, actionName: action.name };
    if (action.multipliers.length === 0) {
      return { ...named, status: "no-damage", reason: "zero-motion-value" };
    }
    if (action.conditionalDamageType) {
      diagnostics.push({ code: "conditional-damage-context-unresolved", severity: "warning", stepId: entry.stepId, actionId: action.id, message: `${action.name}: le type de dégâts conditionnel et ses conditions runtime ne sont pas résolus.` });
      return { ...named, status: "unsupported-damage", reason: "conditional-damage-context-unresolved", reasonDetails: action.conditionalDamageType.condition };
    }
    if (action.requiredState?.length || action.costs?.length || action.requiredForm) {
      diagnostics.push({ code: "rotation-prerequisites-not-validated", severity: "information", stepId: entry.stepId, actionId: action.id, message: "L'action déclarée est calculable, mais ses prérequis gameplay ne sont pas validés en V0.1." });
    }
    const damage = calculateActionDamage({
      action,
      finalStats: request.build.finalStats,
      attackerLevel: request.build.characterLevel,
      scalingAttribute: request.scalingAttribute,
      element: request.resonator.element,
      target: request.target,
    });
    if (damage.status === "unsupported") {
      return { ...named, status: "unsupported-damage", reason: "damage-engine-unsupported", reasonDetails: damage.reason };
    }
    totals.nonCrit += damage.total.nonCrit;
    totals.crit += damage.total.crit;
    totals.expected += damage.total.expected;
    return { ...named, status: "calculated", damage };
  });

  if (request.build.sequence !== 0) {
    diagnostics.push({ code: "sequence-effects-not-applied", severity: "warning", message: `Le build S${request.build.sequence} est accepté, mais les effets de Sequence ne sont pas tous appliqués.` });
  }
  const duration = request.timeline.finalDurationSeconds;
  const counts = {
    total: stepResults.length,
    calculated: stepResults.filter((step) => step.status === "calculated").length,
    "no-damage": stepResults.filter((step) => step.status === "no-damage").length,
    "unsupported-damage": stepResults.filter((step) => step.status === "unsupported-damage").length,
    "unmapped-action": stepResults.filter((step) => step.status === "unmapped-action").length,
  };
  return {
    version: "combat-simulation-v0.1",
    resonator: { id: request.resonator.id, name: request.resonator.name, element: request.resonator.element },
    build: { id: request.build.id, level: request.build.characterLevel, sequence: request.build.sequence },
    resonanceMode: request.resonanceMode,
    rotationId: request.timeline.rotationId,
    rotationDurationSeconds: duration,
    temporalConfidence: request.timeline.confidence,
    calibrationFactor: request.timeline.calibrationFactor,
    target: request.target,
    partial: true,
    stepResults,
    supportedDamage: totals,
    supportedDps: { nonCrit: totals.nonCrit / duration, crit: totals.crit / duration, expected: totals.expected / duration },
    counts,
    diagnostics,
    unmodeledMechanics: mechanics(request.resonanceMode),
    temporalEffectWindows: request.temporalEffectWindows ?? [],
  };
}
