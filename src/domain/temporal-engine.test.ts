import { describe, expect, it } from "vitest";
import {
  buildTemporalTimeline,
  TemporalCalibrationError,
  temporalProfilesV01,
  type TemporalActionStep,
  type TemporalRotationDefinition,
} from "./temporal-engine";

const estimated = (id: string, profileId: "basic-medium"): TemporalActionStep => ({
  id,
  label: id,
  duration: { confidence: "estimated-default", profileId },
  recoverySeconds: null,
  cancelTimingSeconds: null,
  hitTimingsSeconds: null,
});

const measured = (id: string, durationSeconds: number): TemporalActionStep => ({
  id,
  label: id,
  duration: {
    confidence: "measured",
    durationSeconds,
    source: "Mesure de test",
  },
  recoverySeconds: null,
  cancelTimingSeconds: null,
  hitTimingsSeconds: null,
});

const definition = (
  steps: readonly TemporalActionStep[],
  targetDuration?: number,
): TemporalRotationDefinition => ({
  id: "test-rotation",
  name: "Rotation test",
  policy: "no-quickswap",
  steps,
  targetDuration:
    targetDuration === undefined
      ? undefined
      : {
          seconds: targetDuration,
          confidence: "community-calculation",
          source: "Cible externe de test",
        },
});

describe("Temporal Engine V0.1", () => {
  it("conserve strictement les durées mesurées et calibre seulement les estimations", () => {
    const timeline = buildTemporalTimeline(
      definition([measured("measured", 2), estimated("estimated", "basic-medium")], 5),
    );

    expect(timeline.measuredDurationSeconds).toBe(2);
    expect(timeline.estimatedDurationSeconds).toBe(0.6);
    expect(timeline.calibrationFactor).toBe(5);
    expect(timeline.entries[0]).toMatchObject({
      baseDurationSeconds: 2,
      effectiveDurationSeconds: 2,
      confidence: "measured",
    });
    expect(timeline.entries[1]).toMatchObject({
      baseDurationSeconds: 0.6,
      effectiveDurationSeconds: 3,
      confidence: "estimated-calibrated",
    });
    expect(timeline.finalDurationSeconds).toBe(5);
    expect(timeline.diagnostics[0].code).toBe("extreme-calibration-factor");
  });

  it("garde les fallbacks estimated-default en l'absence de cible", () => {
    const timeline = buildTemporalTimeline(
      definition([
        estimated("first", "basic-medium"),
        estimated("second", "basic-medium"),
      ]),
    );

    expect(timeline.calibrationFactor).toBeNull();
    expect(timeline.confidence).toBe("estimated-default");
    expect(timeline.entries.every((entry) => entry.confidence === "estimated-default")).toBe(true);
    expect(timeline.finalDurationSeconds).toBe(1.2);
  });

  it("calibre toutes les estimations quand aucune mesure n'est disponible", () => {
    const timeline = buildTemporalTimeline(
      definition([
        estimated("first", "basic-medium"),
        estimated("second", "basic-medium"),
      ], 3),
    );

    expect(timeline.calibrationFactor).toBe(2.5);
    expect(timeline.entries.every((entry) => entry.confidence === "estimated-calibrated")).toBe(true);
    expect(timeline.finalDurationSeconds).toBe(3);
  });

  it("détecte une cible plus courte que le total mesuré", () => {
    expect(() =>
      buildTemporalTimeline(definition([measured("measured", 2)], 1)),
    ).toThrowError(TemporalCalibrationError);
    try {
      buildTemporalTimeline(definition([measured("measured", 2)], 1));
    } catch (error) {
      expect((error as TemporalCalibrationError).failure).toMatchObject({
        code: "target-shorter-than-measured",
        targetDurationSeconds: 1,
        measuredDurationSeconds: 2,
      });
    }
  });

  it("détecte une cible qui ne laisse aucun temps aux estimations", () => {
    try {
      buildTemporalTimeline(
        definition(
          [measured("measured", 2), estimated("estimated", "basic-medium")],
          2,
        ),
      );
      throw new Error("La calibration aurait dû échouer.");
    } catch (error) {
      expect((error as TemporalCalibrationError).failure.code).toBe(
        "target-leaves-no-time-for-estimates",
      );
    }
  });

  it("refuse toute durée négative, nulle ou non finie", () => {
    for (const durationSeconds of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        buildTemporalTimeline(definition([measured("invalid", durationSeconds)])),
      ).toThrowError(TemporalCalibrationError);
    }
  });

  it("produit un ordre et des timestamps déterministes sans inventer les timings fins", () => {
    const input = definition([
      estimated("first", "basic-medium"),
      measured("second", 0.4),
      estimated("third", "basic-medium"),
    ]);
    const firstRun = buildTemporalTimeline(input);
    const secondRun = buildTemporalTimeline(input);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun.entries.map((entry) => entry.stepId)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(firstRun.entries.map((entry) => [entry.startTimeSeconds, entry.endTimeSeconds])).toEqual([
      [0, 0.6],
      [0.6, 1],
      [1, 1.6],
    ]);
    expect(firstRun.entries.every((entry) =>
      entry.recoverySeconds === null &&
      entry.cancelTimingSeconds === null &&
      entry.hitTimingsSeconds === null
    )).toBe(true);
  });

  it("publie exactement les treize profils fallback V0.1 attendus", () => {
    expect(
      Object.fromEntries(
        Object.entries(temporalProfilesV01).map(([id, value]) => [
          id,
          value.durationSeconds,
        ]),
      ),
    ).toEqual({
      "basic-short": 0.3,
      "basic-medium": 0.6,
      "basic-long": 0.9,
      heavy: 1,
      "skill-short": 1,
      "skill-medium": 1.3,
      "liberation-short": 0.7,
      "liberation-long": 1.2,
      intro: 0.5,
      outro: 0.6,
      "echo-skill": 0.8,
      "form-switch-short": 0.5,
      "very-short": 0.25,
    });
  });
});
