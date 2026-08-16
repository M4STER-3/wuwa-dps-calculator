import { describe, expect, it } from "vitest";
import { aemeath, aemeathPreset } from "@/data/aemeath";
import {
  aemeathTemporalEffectWindows,
  aemeathTemporalTimeline,
} from "@/data/aemeath-temporal";
import { createBuildFromPreset } from "./character-box";
import { simulateCombat } from "./combat-simulation";
import { calculateActionDamage, type DamageTarget } from "./damage-engine";

const build = createBuildFromPreset(aemeathPreset, {
  id: "aemeath-reference",
  now: "2026-08-16T00:00:00.000Z",
});
const target: DamageTarget & { tuneEnemyClass: "4C" } = {
  level: 90,
  elementalResistance: { fusion: 0.1 },
  physicalResistance: 0.1,
  tuneEnemyClass: "4C",
};
const run = (
  overrides: Partial<Parameters<typeof simulateCombat>[0]> = {},
) =>
  simulateCombat({
    resonator: aemeath,
    build,
    resonanceMode: "tune-rupture",
    timeline: aemeathTemporalTimeline,
    target,
    scalingAttribute: "attack",
    temporalEffectWindows: aemeathTemporalEffectWindows,
    ...overrides,
  });

describe("Combat Simulation V0.1 — intégration Aemeath S0", () => {
  it("orchestre les 18 occurrences et conserve leur provenance temporelle", () => {
    const result = run();
    expect(result.rotationDurationSeconds).toBeCloseTo(11.69, 10);
    expect(result.temporalConfidence).toBe("estimated-calibrated");
    expect(result.calibrationFactor).toBe(aemeathTemporalTimeline.calibrationFactor);
    expect(result.counts).toEqual({
      total: 18,
      calculated: 13,
      "no-damage": 4,
      "unsupported-damage": 1,
      "unmapped-action": 0,
    });
    expect(result.partial).toBe(true);
    expect(result.stepResults.every((step) => step.hitTimingsSeconds === null)).toBe(true);
  });

  it("préserve chaque Basic répétée comme une occurrence distincte", () => {
    const calculated = run().stepResults.filter((step) => step.status === "calculated");
    expect(calculated.filter((step) => step.actionId === "mech-basic-3")).toHaveLength(2);
    expect(calculated.filter((step) => step.actionId === "mech-basic-4")).toHaveLength(2);
    expect(calculated.map((step) => step.actionId)).toEqual([
      "intro-mech", "mech-basic-3", "mech-basic-4", "overdrive",
      "mech-basic-2", "mech-basic-3", "mech-basic-4", "seraphic-encore",
      "aemeath-basic-2", "aemeath-basic-3", "aemeath-basic-4",
      "seraphic-overture", "finale",
    ]);
  });

  it("classe les Form Switch et l'Outro sans erreur ni faux dégâts", () => {
    const noDamage = run().stepResults.filter((step) => step.status === "no-damage");
    expect(noDamage.map((step) => step.stepId)).toEqual([
      "skill-first", "skill-second", "form-switch-loop", "outro",
    ]);
    expect(noDamage.slice(0, 3).every((step) => step.reason === "zero-motion-value")).toBe(true);
    expect(noDamage[3]).toMatchObject({ reason: "no-action-associated", actionId: undefined });
  });

  it("exclut uniquement Mech Heavy II et calcule Finale malgré ses prérequis", () => {
    const result = run();
    expect(result.stepResults.find((step) => step.stepId === "mech-heavy-2")).toMatchObject({
      status: "unsupported-damage",
      reason: "conditional-damage-context-unresolved",
    });
    expect(result.stepResults.find((step) => step.stepId === "finale")?.status).toBe("calculated");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "rotation-prerequisites-not-validated",
      actionId: "finale",
    }));
  });

  it("obtient les totaux supportés de référence sans arrondi intermédiaire", () => {
    const result = run();
    expect(result.supportedDamage.nonCrit).toBeCloseTo(57666.72253298153, 8);
    expect(result.supportedDamage.crit).toBeCloseTo(121100.1173192612, 8);
    expect(result.supportedDamage.expected).toBeCloseTo(98898.42914406332, 8);
    expect(result.supportedDps.expected).toBeCloseTo(8460.088036275734, 8);
    expect(result.supportedDps.expected).toBe(
      result.supportedDamage.expected / aemeathTemporalTimeline.finalDurationSeconds,
    );
    const motionValue = result.stepResults.reduce(
      (total, step) => total + (step.damage?.totalMotionValue ?? 0), 0,
    );
    expect(motionValue).toBeCloseTo(45.6468, 10);
  });

  it("produit exactement le résultat direct du Damage Engine pour l'Intro", () => {
    const simulated = run().stepResults.find((step) => step.actionId === "intro-mech")!;
    const action = aemeath.combat!.actions.find((candidate) => candidate.id === "intro-mech")!;
    const direct = calculateActionDamage({
      action,
      finalStats: build.finalStats,
      attackerLevel: build.characterLevel,
      scalingAttribute: "attack",
      element: aemeath.element,
      target,
    });
    expect(simulated.damage).toEqual(direct);
  });

  it("conserve le mode et représente les événements absents comme non émis, pas zéro", () => {
    const tune = run();
    expect(tune.resonanceMode).toBe("tune-rupture");
    expect(tune.unmodeledMechanics).toContainEqual(expect.objectContaining({
      id: "automatic-starburst", state: "not-emitted", formulaSupport: "available",
    }));
    expect(tune.unmodeledMechanics).toContainEqual(expect.objectContaining({
      id: "seraphic-tune-rupture-bonus", state: "not-emitted",
    }));
    expect(tune.stepResults.some((step) => ["starburst", "seraphic-bonus", "fusion-burst"].includes(step.actionId ?? ""))).toBe(false);

    const fusion = run({ resonanceMode: "fusion-burst" });
    expect(fusion.resonanceMode).toBe("fusion-burst");
    expect(fusion.unmodeledMechanics).toContainEqual(expect.objectContaining({
      id: "fusion-burst-damage", state: "not-emitted", formulaSupport: "not-available",
    }));
    expect(fusion.unmodeledMechanics.some((item) => item.mode === "tune-rupture")).toBe(false);
  });

  it("retourne une incohérence structurée pour un actionId absent", () => {
    const timeline = {
      ...aemeathTemporalTimeline,
      entries: aemeathTemporalTimeline.entries.map((entry, index) =>
        index === 0 ? { ...entry, actionId: "missing-action" } : entry,
      ),
    };
    const result = run({ timeline });
    expect(result.stepResults[0]).toMatchObject({
      status: "unmapped-action", reason: "action-not-found", actionId: "missing-action",
    });
    expect(result.diagnostics[0]).toMatchObject({ code: "action-not-found", actionId: "missing-action" });
  });

  it("réagit à la RES Fusion de la cible via le Damage Engine", () => {
    const reference = run();
    const resistant = run({ target: { ...target, elementalResistance: { fusion: 0.3 } } });
    expect(resistant.supportedDamage.expected).toBeLessThan(reference.supportedDamage.expected);
  });

  it("lit l'ATK modifiée exclusivement depuis finalStats", () => {
    const strongerBuild = {
      ...build,
      finalStats: { ...build.finalStats, attack: build.finalStats.attack * 1.25 },
    };
    const reference = run();
    const stronger = run({ build: strongerBuild });
    expect(stronger.supportedDamage.nonCrit).toBeCloseTo(reference.supportedDamage.nonCrit * 1.25, 8);
    expect(stronger.supportedDamage.expected).toBeCloseTo(reference.supportedDamage.expected * 1.25, 8);
  });
});
