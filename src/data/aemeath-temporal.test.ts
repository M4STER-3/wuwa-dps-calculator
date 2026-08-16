import { describe, expect, it } from "vitest";
import { aemeath } from "./aemeath";
import {
  aemeathTemporalEffectWindows,
  aemeathTemporalRotationDefinition,
  aemeathTemporalTimeline,
} from "./aemeath-temporal";

describe("timeline temporelle d'Aemeath", () => {
  it("utilise la rotation no-quickswap existante et sa cible communautaire", () => {
    const sourceRotation = aemeath.combat!.rotations.find(
      (rotation) => rotation.id === aemeathTemporalRotationDefinition.id,
    )!;

    expect(aemeathTemporalTimeline.policy).toBe("no-quickswap");
    expect(aemeathTemporalTimeline.targetDurationSeconds).toBe(11.69);
    expect(aemeathTemporalTimeline.targetConfidence).toBe(
      "community-calculation",
    );
    for (const step of aemeathTemporalRotationDefinition.steps) {
      expect(step.label).toBe(sourceRotation.steps[step.rotationStepIndex!]);
    }
  });

  it("calibre les fallbacks et termine autour de 11,69 secondes", () => {
    expect(aemeathTemporalTimeline.rawDurationSeconds).toBeCloseTo(14.6, 10);
    expect(aemeathTemporalTimeline.calibrationFactor).toBeCloseTo(
      11.69 / 14.6,
      10,
    );
    expect(aemeathTemporalTimeline.finalDurationSeconds).toBeCloseTo(11.69, 10);
    expect(aemeathTemporalTimeline.confidence).toBe("estimated-calibrated");
    expect(
      aemeathTemporalTimeline.entries.every(
        (entry) =>
          entry.confidence === "estimated-calibrated" &&
          Number.isFinite(entry.effectiveDurationSeconds) &&
          entry.effectiveDurationSeconds > 0,
      ),
    ).toBe(true);
  });

  it("conserve hit timings, recovery et cancel timings explicitement inconnus", () => {
    expect(
      aemeathTemporalTimeline.entries.every(
        (entry) =>
          entry.hitTimingsSeconds === null &&
          entry.recoverySeconds === null &&
          entry.cancelTimingSeconds === null,
      ),
    ).toBe(true);
  });

  it("positionne les fenêtres résolubles et préserve les conditions déclaratives", () => {
    const starlume = aemeathTemporalEffectWindows.find(
      (window) => window.effectId === "starlume",
    )!;
    const stardust = aemeathTemporalEffectWindows.find(
      (window) => window.effectId === "stardust-resonance",
    )!;
    const unbound = aemeathTemporalEffectWindows.find(
      (window) => window.effectId === "unbound",
    )!;
    const weapon = aemeathTemporalEffectWindows.find(
      (window) => window.effectId === "everbright-r1-liberation",
    )!;

    expect(starlume.startTimeSeconds).not.toBeNull();
    expect(starlume.endTimeSeconds).toBe(
      aemeathTemporalTimeline.entries.find((entry) => entry.stepId === "overdrive")!
        .startTimeSeconds,
    );
    expect(stardust.endTimeSeconds).toBe(
      aemeathTemporalTimeline.entries.find(
        (entry) => entry.stepId === "seraphic-overture",
      )!.endTimeSeconds,
    );
    expect(unbound.endTimeSeconds).toBe(
      aemeathTemporalTimeline.entries.find((entry) => entry.stepId === "finale")!
        .startTimeSeconds,
    );
    expect(unbound.unresolvedConditions).toContain(
      "Autres conditions de fin documentées par le kit.",
    );
    expect(weapon.startTimeSeconds).toBeNull();
    expect(weapon.endTimeSeconds).toBeNull();
    expect(weapon.unresolvedConditions).toContain(
      "Expiration maximale après 8 s",
    );
  });
});
