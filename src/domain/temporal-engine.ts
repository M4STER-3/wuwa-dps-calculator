export const temporalProfileIds = [
  "basic-short",
  "basic-medium",
  "basic-long",
  "heavy",
  "skill-short",
  "skill-medium",
  "liberation-short",
  "liberation-long",
  "intro",
  "outro",
  "echo-skill",
  "form-switch-short",
  "very-short",
] as const;

export type TemporalProfileId = (typeof temporalProfileIds)[number];
export type TemporalConfidence =
  | "measured"
  | "estimated-default"
  | "estimated-calibrated";

export interface TemporalProfile {
  id: TemporalProfileId;
  label: string;
  durationSeconds: number;
  confidence: "estimated-default";
  source: string;
  definedAt: "2026-08-16";
  version: "v0.1";
}

const fallbackSource =
  "Fallback temporel raisonné V0.1; valeurs non officielles. Référence disponible: environ 20 frames à 30 FPS pour 3 Basic Attacks rapides de Shorekeeper.";

const profile = (
  id: TemporalProfileId,
  label: string,
  durationSeconds: number,
): TemporalProfile => ({
  id,
  label,
  durationSeconds,
  confidence: "estimated-default",
  source: fallbackSource,
  definedAt: "2026-08-16",
  version: "v0.1",
});

export const temporalProfilesV01: Readonly<
  Record<TemporalProfileId, TemporalProfile>
> = {
  "basic-short": profile("basic-short", "Basic Attack courte", 0.3),
  "basic-medium": profile("basic-medium", "Basic Attack moyenne", 0.6),
  "basic-long": profile("basic-long", "Basic Attack longue", 0.9),
  heavy: profile("heavy", "Heavy Attack", 1),
  "skill-short": profile("skill-short", "Resonance Skill courte", 1),
  "skill-medium": profile("skill-medium", "Resonance Skill moyenne", 1.3),
  "liberation-short": profile(
    "liberation-short",
    "Resonance Liberation courte",
    0.7,
  ),
  "liberation-long": profile(
    "liberation-long",
    "Resonance Liberation longue",
    1.2,
  ),
  intro: profile("intro", "Intro", 0.5),
  outro: profile("outro", "Outro", 0.6),
  "echo-skill": profile("echo-skill", "Echo Skill", 0.8),
  "form-switch-short": profile(
    "form-switch-short",
    "Form Switch / transformation courte",
    0.5,
  ),
  "very-short": profile("very-short", "Action très courte", 0.25),
};

export type TemporalDurationInput =
  | {
      confidence: "measured";
      durationSeconds: number;
      source: string;
    }
  | {
      confidence: "estimated-default";
      profileId: TemporalProfileId;
      sourceNote?: string;
    };

export interface TemporalActionStep {
  id: string;
  label: string;
  actionId?: string;
  rotationStepIndex?: number;
  duration: TemporalDurationInput;
  recoverySeconds: number | null;
  cancelTimingSeconds: number | null;
  hitTimingsSeconds: readonly number[] | null;
  notes?: readonly string[];
}

export interface TemporalRotationDefinition {
  id: string;
  name: string;
  policy: "no-quickswap";
  steps: readonly TemporalActionStep[];
  targetDuration?: {
    seconds: number;
    confidence: string;
    source: string;
  };
}

export interface TimelineEntry {
  index: number;
  stepId: string;
  label: string;
  actionId?: string;
  rotationStepIndex?: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  baseDurationSeconds: number;
  effectiveDurationSeconds: number;
  confidence: TemporalConfidence;
  profileId?: TemporalProfileId;
  source: string;
  recoverySeconds: number | null;
  cancelTimingSeconds: number | null;
  hitTimingsSeconds: readonly number[] | null;
  notes: readonly string[];
}

export interface TemporalDiagnostic {
  code: "extreme-calibration-factor";
  severity: "warning";
  message: string;
}

export interface TemporalTimeline {
  rotationId: string;
  name: string;
  policy: "no-quickswap";
  targetDurationSeconds: number | null;
  targetConfidence: string | null;
  targetSource: string | null;
  rawDurationSeconds: number;
  measuredDurationSeconds: number;
  estimatedDurationSeconds: number;
  calibrationFactor: number | null;
  finalDurationSeconds: number;
  confidence: TemporalConfidence;
  entries: readonly TimelineEntry[];
  diagnostics: readonly TemporalDiagnostic[];
}

export interface TemporalCalibrationFailure {
  code:
    | "invalid-duration"
    | "target-shorter-than-measured"
    | "target-leaves-no-time-for-estimates"
    | "target-requires-missing-estimates";
  targetDurationSeconds: number | null;
  measuredDurationSeconds: number;
  estimatedDurationSeconds: number;
  message: string;
}

export class TemporalCalibrationError extends Error {
  constructor(public readonly failure: TemporalCalibrationFailure) {
    super(failure.message);
    this.name = "TemporalCalibrationError";
  }
}

function assertPositiveFiniteDuration(
  duration: number,
  context: string,
): void {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new TemporalCalibrationError({
      code: "invalid-duration",
      targetDurationSeconds: null,
      measuredDurationSeconds: 0,
      estimatedDurationSeconds: 0,
      message: `${context} doit être une durée finie strictement positive.`,
    });
  }
}

export function buildTemporalTimeline(
  definition: TemporalRotationDefinition,
): TemporalTimeline {
  if (definition.steps.length === 0) {
    throw new TemporalCalibrationError({
      code: "invalid-duration",
      targetDurationSeconds: definition.targetDuration?.seconds ?? null,
      measuredDurationSeconds: 0,
      estimatedDurationSeconds: 0,
      message: "Une rotation temporelle doit contenir au moins une action.",
    });
  }
  const resolved = definition.steps.map((step) => {
    const duration =
      step.duration.confidence === "measured"
        ? step.duration.durationSeconds
        : temporalProfilesV01[step.duration.profileId].durationSeconds;
    assertPositiveFiniteDuration(duration, `La durée de ${step.id}`);
    return { step, duration };
  });
  const measuredDurationSeconds = resolved
    .filter(({ step }) => step.duration.confidence === "measured")
    .reduce((total, { duration }) => total + duration, 0);
  const estimatedDurationSeconds = resolved
    .filter(({ step }) => step.duration.confidence === "estimated-default")
    .reduce((total, { duration }) => total + duration, 0);
  const rawDurationSeconds =
    measuredDurationSeconds + estimatedDurationSeconds;
  const targetDurationSeconds = definition.targetDuration?.seconds ?? null;
  let calibrationFactor: number | null = null;

  if (targetDurationSeconds !== null) {
    assertPositiveFiniteDuration(targetDurationSeconds, "La durée cible");
    if (targetDurationSeconds < measuredDurationSeconds) {
      throw new TemporalCalibrationError({
        code: "target-shorter-than-measured",
        targetDurationSeconds,
        measuredDurationSeconds,
        estimatedDurationSeconds,
        message:
          "La durée cible est inférieure au total mesuré; les mesures ne seront jamais altérées pour forcer la calibration.",
      });
    }
    if (estimatedDurationSeconds === 0) {
      if (targetDurationSeconds !== measuredDurationSeconds) {
        throw new TemporalCalibrationError({
          code: "target-requires-missing-estimates",
          targetDurationSeconds,
          measuredDurationSeconds,
          estimatedDurationSeconds,
          message:
            "La cible diffère du total mesuré mais aucune durée estimée ne peut absorber l'écart.",
        });
      }
    } else {
      const remainingTime = targetDurationSeconds - measuredDurationSeconds;
      if (remainingTime <= 0) {
        throw new TemporalCalibrationError({
          code: "target-leaves-no-time-for-estimates",
          targetDurationSeconds,
          measuredDurationSeconds,
          estimatedDurationSeconds,
          message:
            "La cible ne laisse aucune durée positive aux actions estimées; les mesures restent inchangées.",
        });
      }
      calibrationFactor = remainingTime / estimatedDurationSeconds;
      assertPositiveFiniteDuration(calibrationFactor, "Le facteur de calibration");
    }
  }

  const diagnostics: TemporalDiagnostic[] = [];
  if (
    calibrationFactor !== null &&
    (calibrationFactor < 0.5 || calibrationFactor > 2)
  ) {
    diagnostics.push({
      code: "extreme-calibration-factor",
      severity: "warning",
      message: `Le facteur ${calibrationFactor.toFixed(3)} est hors de la plage prudente 0,5–2,0; vérifier la cible, les profils et les actions manquantes.`,
    });
  }

  let cursor = 0;
  const entries: TimelineEntry[] = resolved.map(({ step, duration }, index) => {
    const estimated = step.duration.confidence === "estimated-default";
    const effectiveDurationSeconds =
      estimated && calibrationFactor !== null
        ? duration * calibrationFactor
        : duration;
    assertPositiveFiniteDuration(
      effectiveDurationSeconds,
      `La durée effective de ${step.id}`,
    );
    const startTimeSeconds = cursor;
    cursor += effectiveDurationSeconds;
    return {
      index,
      stepId: step.id,
      label: step.label,
      actionId: step.actionId,
      rotationStepIndex: step.rotationStepIndex,
      startTimeSeconds,
      endTimeSeconds: cursor,
      baseDurationSeconds: duration,
      effectiveDurationSeconds,
      confidence: estimated
        ? calibrationFactor === null
          ? "estimated-default"
          : "estimated-calibrated"
        : "measured",
      profileId:
        step.duration.confidence === "estimated-default"
          ? step.duration.profileId
          : undefined,
      source:
        step.duration.confidence === "measured"
          ? step.duration.source
          : [
              temporalProfilesV01[step.duration.profileId].source,
              step.duration.sourceNote,
            ]
              .filter(Boolean)
              .join(" "),
      recoverySeconds: step.recoverySeconds,
      cancelTimingSeconds: step.cancelTimingSeconds,
      hitTimingsSeconds: step.hitTimingsSeconds,
      notes: step.notes ?? [],
    };
  });

  const hasMeasured = measuredDurationSeconds > 0;
  const hasEstimated = estimatedDurationSeconds > 0;
  const confidence: TemporalConfidence = hasEstimated
    ? calibrationFactor === null
      ? "estimated-default"
      : "estimated-calibrated"
    : hasMeasured
      ? "measured"
      : "estimated-default";

  return {
    rotationId: definition.id,
    name: definition.name,
    policy: definition.policy,
    targetDurationSeconds,
    targetConfidence: definition.targetDuration?.confidence ?? null,
    targetSource: definition.targetDuration?.source ?? null,
    rawDurationSeconds,
    measuredDurationSeconds,
    estimatedDurationSeconds,
    calibrationFactor,
    finalDurationSeconds: cursor,
    confidence,
    entries,
    diagnostics,
  };
}

export type TemporalEffectEndRule =
  | { kind: "maximum-duration"; seconds: number }
  | { kind: "action-start"; stepId: string }
  | { kind: "action-end"; stepId: string }
  | { kind: "usage-count"; stepIds: readonly string[]; count: number }
  | { kind: "refresh"; description: string }
  | { kind: "reset"; description: string }
  | { kind: "declarative"; description: string };

export interface TemporalEffectDefinition {
  effectId: string;
  sourceId: string;
  label: string;
  activation:
    | { kind: "action-start"; stepId: string }
    | { kind: "action-end"; stepId: string }
    | { kind: "external-trigger"; description: string };
  endRules: readonly TemporalEffectEndRule[];
}

export interface TemporalEffectWindow {
  effectId: string;
  sourceId: string;
  label: string;
  startTimeSeconds: number | null;
  endTimeSeconds: number | null;
  maximumEndTimeSeconds: number | null;
  activation: TemporalEffectDefinition["activation"];
  endRules: readonly TemporalEffectEndRule[];
  unresolvedConditions: readonly string[];
}

const findEntry = (timeline: TemporalTimeline, stepId: string) =>
  timeline.entries.find((entry) => entry.stepId === stepId);

export function buildTemporalEffectWindows(
  timeline: TemporalTimeline,
  definitions: readonly TemporalEffectDefinition[],
): readonly TemporalEffectWindow[] {
  return definitions.map((definition) => {
    const activationEntry =
      definition.activation.kind === "external-trigger"
        ? undefined
        : findEntry(timeline, definition.activation.stepId);
    const startTimeSeconds =
      definition.activation.kind === "external-trigger" || !activationEntry
        ? null
        : definition.activation.kind === "action-start"
          ? activationEntry.startTimeSeconds
          : activationEntry.endTimeSeconds;
    const resolvedEnds: number[] = [];
    const unresolvedConditions: string[] = [];
    let maximumEndTimeSeconds: number | null = null;

    for (const rule of definition.endRules) {
      if (rule.kind === "maximum-duration") {
        assertPositiveFiniteDuration(
          rule.seconds,
          `La durée maximale de ${definition.effectId}`,
        );
        if (startTimeSeconds === null) {
          unresolvedConditions.push(`Expiration maximale après ${rule.seconds} s`);
        } else {
          maximumEndTimeSeconds = startTimeSeconds + rule.seconds;
          resolvedEnds.push(maximumEndTimeSeconds);
        }
      } else if (rule.kind === "action-start" || rule.kind === "action-end") {
        const entry = findEntry(timeline, rule.stepId);
        if (entry) {
          resolvedEnds.push(
            rule.kind === "action-start"
              ? entry.startTimeSeconds
              : entry.endTimeSeconds,
          );
        } else {
          unresolvedConditions.push(`Action temporelle absente: ${rule.stepId}`);
        }
      } else if (rule.kind === "usage-count") {
        const occurrence = rule.stepIds
          .map((stepId) => findEntry(timeline, stepId))
          .filter((entry): entry is TimelineEntry => Boolean(entry))
          .filter(
            (entry) =>
              startTimeSeconds === null ||
              entry.endTimeSeconds >= startTimeSeconds,
          )
          .sort((left, right) => left.index - right.index)[rule.count - 1];
        if (occurrence) resolvedEnds.push(occurrence.endTimeSeconds);
        else
          unresolvedConditions.push(
            `Fin après ${rule.count} utilisation(s): ${rule.stepIds.join(", ")}`,
          );
      } else {
        unresolvedConditions.push(rule.description);
      }
    }

    const eligibleEnds =
      startTimeSeconds === null
        ? []
        : resolvedEnds.filter((end) => end >= startTimeSeconds);

    return {
      effectId: definition.effectId,
      sourceId: definition.sourceId,
      label: definition.label,
      startTimeSeconds,
      endTimeSeconds:
        eligibleEnds.length === 0 ? null : Math.min(...eligibleEnds),
      maximumEndTimeSeconds,
      activation: definition.activation,
      endRules: definition.endRules,
      unresolvedConditions,
    };
  });
}
