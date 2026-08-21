import { describe, expect, it } from "vitest";
import { createBuildFromPreset } from "@/domain/character-box";
import { evaluatePredicate, type CombatContext } from "@/domain/combat-context";
import { resolvePersonalLoadout } from "@/domain/personal-dps-lab";
import { withPreciseMainEchoCast } from "@/domain/precise-main-echo-scenarios";
import { preciseDpsFutureScenarios } from "./precise-dps-future";
import { presets, sonatas } from "./catalog";
import {
  FLAMEWING_FUSION_CONJUNCTION_ID,
  preciseSonataTierCoverageWithPersonalCompletions,
} from "./precise-sonata-personal-completions";

const expected = {
  qiuyuan: {
    mainEcho: "Reminiscence: Fenrico",
    mainEchoAction: "precise-fenrico-echo-skill",
    sonatas: ["Law of Harmony", "Sound of True Name"],
    sonataEffects: [
      "sonata-set:21:3pc:heavy-self",
      "sonata-set:29:2pc:aero",
    ],
    mainEchoEffects: [
      "precise-fenrico-element",
      "precise-fenrico-heavy",
    ],
  },
  galbrena: {
    mainEcho: "Corrosaurus",
    mainEchoAction: "precise-corrosaurus-echo-skill",
    sonatas: ["Flamewing's Shadow", "Chromatic Foam"],
    sonataEffects: [
      "sonata-set:22:3pc:heavy-crit",
      "sonata-set:22:3pc:echo-crit",
      FLAMEWING_FUSION_CONJUNCTION_ID,
      "sonata-set:28:2pc:fusion",
    ],
    mainEchoEffects: [
      "precise-corrosaurus-element",
      "precise-corrosaurus-echo",
    ],
  },
} as const;

function preciseBuild(resonatorId: keyof typeof expected) {
  const preset = presets.find((entry) => entry.resonatorId === resonatorId);
  expect(preset, `${resonatorId} precise preset`).toBeDefined();
  return createBuildFromPreset(preset!, {
    id: `equipment-complete-${resonatorId}`,
    now: "2026-08-21T13:45:00.000Z",
  });
}

function predicateContext(activeEffectIds: readonly string[]): CombatContext {
  return {
    timestamp: 0,
    actorId: "galbrena",
    ownerId: "galbrena",
    targetId: "training-target",
    panelStats: {
      hp: 1,
      attack: 1,
      defense: 1,
      critRate: 0,
      critDamage: 0,
      energyRegen: 0,
      healingBonus: 0,
      tuneBreakBoost: 0,
      elementalDamageBonus: {
        aero: 0,
        glacio: 0,
        electro: 0,
        fusion: 0,
        havoc: 0,
        spectro: 0,
      },
      damageTypeBonus: {
        basicAttack: 0,
        heavyAttack: 0,
        resonanceSkill: 0,
        resonanceLiberation: 0,
        introSkill: 0,
        echoSkill: 0,
      },
    },
    element: "fusion",
    activeEffectIds,
  };
}

describe("Qiuyuan + Galbrena precise equipment completion", () => {
  for (const resonatorId of ["qiuyuan", "galbrena"] as const) {
    it(`${resonatorId} resolves the reviewed 3+2 Sonata build and real Main Echo`, () => {
      const build = preciseBuild(resonatorId);
      const loadout = resolvePersonalLoadout(build);
      const target = expected[resonatorId];

      expect(loadout.supported).toBe(true);
      expect(loadout.mainEcho?.name).toBe(target.mainEcho);
      expect(loadout.mainEcho?.action?.id).toBe(target.mainEchoAction);
      expect(loadout.sonatas.map((sonata) => sonata.name)).toEqual(
        expect.arrayContaining([...target.sonatas]),
      );
      expect(loadout.sonataEffects.map((effect) => effect.id)).toEqual(
        expect.arrayContaining([...target.sonataEffects]),
      );
      expect(loadout.effects.map((effect) => effect.id)).toEqual(
        expect.arrayContaining([...target.mainEchoEffects]),
      );
      expect(loadout.actions.filter((action) => action.id === target.mainEchoAction)).toHaveLength(1);
    });

    it(`${resonatorId} executes the equipped Main Echo as one real rotation action`, () => {
      const build = preciseBuild(resonatorId);
      const loadout = resolvePersonalLoadout(build);
      const baseScenario = preciseDpsFutureScenarios.find(
        (scenario) => scenario.resonatorId === resonatorId && !scenario.resonanceMode,
      ) ?? preciseDpsFutureScenarios.find((scenario) => scenario.resonatorId === resonatorId);

      expect(baseScenario).toBeDefined();
      const scenario = withPreciseMainEchoCast(
        baseScenario!,
        resonatorId,
        loadout.mainEcho,
        loadout.actions,
      );

      expect(
        scenario.rotation.steps.filter((step) => step.actionId === expected[resonatorId].mainEchoAction),
      ).toHaveLength(1);
    });
  }

  it("marks Flamewing 3-piece personal runtime complete", () => {
    expect(
      preciseSonataTierCoverageWithPersonalCompletions.find(
        (entry) => entry.sonataSetId === "sonata-set:22" && entry.pieces === 3,
      ),
    ).toMatchObject({ coverage: "personal-complete" });
  });

  it("applies Flamewing +16% Fusion only while both 6s Crit windows overlap", () => {
    const flamewing = sonatas.find((sonata) => sonata.id === "sonata-set:22");
    const tier = flamewing?.pieceBonuses?.find((piece) => piece.pieces === 3);
    const conjunction = tier?.effects?.find(
      (effect) => effect.id === FLAMEWING_FUSION_CONJUNCTION_ID,
    )?.structuredEffect;
    const rule = conjunction?.rules[0];

    expect(conjunction?.activationPolicy).toBe("initially-active");
    expect(rule?.modifiers).toContainEqual({
      kind: "elemental-damage-bonus",
      stacking: "additive",
      value: 16,
    });
    expect(rule?.predicates).toEqual([
      { kind: "has-effect", id: "sonata-set:22:3pc:heavy-crit" },
      { kind: "has-effect", id: "sonata-set:22:3pc:echo-crit" },
    ]);

    const both = predicateContext([
      "sonata-set:22:3pc:heavy-crit",
      "sonata-set:22:3pc:echo-crit",
      FLAMEWING_FUSION_CONJUNCTION_ID,
    ]);
    expect(rule?.predicates?.map((predicate) => evaluatePredicate(predicate, both).status)).toEqual([
      "matched",
      "matched",
    ]);

    const heavyOnly = predicateContext([
      "sonata-set:22:3pc:heavy-crit",
      FLAMEWING_FUSION_CONJUNCTION_ID,
    ]);
    expect(rule?.predicates?.map((predicate) => evaluatePredicate(predicate, heavyOnly).status)).toEqual([
      "matched",
      "ignored",
    ]);
  });
});
