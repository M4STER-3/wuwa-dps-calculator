import type { CombatAction } from "./models";
import {
  buildTemporalTimeline,
  temporalProfilesV01,
  type TemporalProfileId,
  type TemporalRotationDefinition,
  type TemporalTimeline,
} from "./temporal-engine";

export interface TheoreticalRotationStep {
  /** Omit for a non-damaging transition such as jump/outro/swap preparation. */
  actionId?: string;
  /** Required for a non-action step; optional display override otherwise. */
  label?: string;
  /** Optional profile override for non-standard transforms/cancels. */
  profileId?: TemporalProfileId;
  /** Repeat the same action/transition without duplicating data rows. */
  repeat?: number;
  notes?: readonly string[];
}

export interface TheoreticalRotationPreset {
  id: string;
  name: string;
  steps: readonly TheoreticalRotationStep[];
}

const hitCount = (action: CombatAction): number =>
  action.multipliers.reduce((total, group) => total + group.hits, 0);

/**
 * Shared timing policy for every Resonator.
 * These are deliberately theoretical timings: no character-specific frame data
 * and no special-case ids. An explicit external duration may calibrate only the
 * estimated windows through the generic Temporal Engine.
 */
export function inferTheoreticalProfile(action: CombatAction): TemporalProfileId {
  const hits = hitCount(action);
  if (action.talent === "introSkill") return "intro";
  if (action.talent === "outroSkill") return "outro";
  if (action.talent === "echoSkill") return "echo-skill";
  if (action.damageType === "heavyAttack") return "heavy";
  if (action.talent === "resonanceLiberation") {
    return hits <= 1 ? "liberation-short" : "liberation-long";
  }
  if (action.talent === "resonanceSkill") {
    return hits <= 3 ? "skill-short" : "skill-medium";
  }
  if (action.talent === "basicAttack") {
    if (hits <= 1) return "basic-short";
    if (hits <= 3) return "basic-medium";
    return "basic-long";
  }
  if (action.talent === "forteCircuit") {
    if (action.damageType === "resonanceLiberation") return "liberation-long";
    if (action.damageType === "basicAttack") return hits <= 3 ? "basic-medium" : "basic-long";
    return "skill-medium";
  }
  return hits === 0 ? "form-switch-short" : "skill-medium";
}

/**
 * Uniformly distributes theoretical hit events inside the shared action window.
 * This exists so hit-triggered passives/set bonuses are simulated consistently
 * for every character without pretending we know exact animation frames.
 */
export function theoreticalHitTimings(
  action: CombatAction,
  profileId: TemporalProfileId,
): readonly number[] | null {
  const hits = hitCount(action);
  if (hits <= 0) return null;
  const duration = temporalProfilesV01[profileId].durationSeconds;
  return Array.from(
    { length: hits },
    (_, index) => (duration * (index + 1)) / (hits + 1),
  );
}

export function buildTheoreticalRotationTimeline(
  preset: TheoreticalRotationPreset,
  actions: readonly CombatAction[],
  targetDuration?: TemporalRotationDefinition["targetDuration"],
): TemporalTimeline {
  const actionsById = new Map(actions.map((action) => [action.id, action]));
  const steps = preset.steps.flatMap((step, stepIndex) => {
    const action = step.actionId ? actionsById.get(step.actionId) : undefined;
    if (step.actionId && !action) {
      throw new Error(
        `Theoretical rotation ${preset.id} references unknown action ${step.actionId}.`,
      );
    }
    if (!action && !step.label) {
      throw new Error(
        `Theoretical rotation ${preset.id} step ${stepIndex} needs an actionId or label.`,
      );
    }
    const repeat = step.repeat ?? 1;
    if (!Number.isInteger(repeat) || repeat <= 0) {
      throw new Error(
        `Theoretical rotation ${preset.id} has invalid repeat at step ${stepIndex}.`,
      );
    }
    const profileId =
      step.profileId ?? (action ? inferTheoreticalProfile(action) : "very-short");
    if (!Object.prototype.hasOwnProperty.call(temporalProfilesV01, profileId)) {
      throw new Error(
        `Theoretical rotation ${preset.id} step ${stepIndex} references unsupported temporal profile ${String(profileId)}.`,
      );
    }
    return Array.from({ length: repeat }, (_, repeatIndex) => ({
      id: `${preset.id}:${stepIndex}:${repeatIndex}:${action?.id ?? "transition"}`,
      label: step.label ?? action!.name,
      ...(action ? { actionId: action.id } : {}),
      rotationStepIndex: stepIndex,
      duration: {
        confidence: "estimated-default" as const,
        profileId,
        sourceNote:
          "Timing théorique universel WUWA LAB; aucune mesure image-par-image propre au personnage.",
      },
      recoverySeconds: null,
      cancelTimingSeconds: null,
      hitTimingsSeconds: action ? theoreticalHitTimings(action, profileId) : null,
      notes: step.notes ?? [],
    }));
  });

  const timeline = buildTemporalTimeline({
    id: preset.id,
    name: preset.name,
    policy: "no-quickswap",
    steps,
    targetDuration,
  });

  if (timeline.calibrationFactor === null) return timeline;
  const calibrationFactor = timeline.calibrationFactor;
  return {
    ...timeline,
    entries: timeline.entries.map((entry) => ({
      ...entry,
      hitTimingsSeconds: entry.hitTimingsSeconds?.map(
        (timing) => timing * calibrationFactor,
      ) ?? null,
    })),
  };
}
