import { describe, expect, it } from "vitest";
import { preciseCharacterBoxPresets } from "./precise-character-box-presets";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";
import { QIUYUAN_MANUAL, QIUYUAN_NATIVE } from "./precise-dps-qiuyuan-core";

const resonator = findPreciseDpsResonator("qiuyuan")!;
const weapon = findPreciseDpsWeapon("qiuyuan")!;
const weaponEffects = weapon.effects ?? [];
const presets = preciseCharacterBoxPresets.filter((entry) => entry.resonatorId === "qiuyuan");

describe("Qiuyuan completion audit", () => {
  it("keeps the reviewed Character Box package exactly once", () => {
    expect(resonator).toMatchObject({
      id: "qiuyuan",
      element: "aero",
      rarity: 5,
      weaponType: "sword",
    });
    expect(weapon).toMatchObject({
      id: "precise-qiuyuan-signature",
      name: "Emerald Sentence",
      rarity: 5,
      level90Stats: { critRate: 24.3 },
    });

    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      id: "qiuyuan-s0-l90-signature-precise",
      resonatorId: "qiuyuan",
      characterLevel: 90,
      sequence: 0,
      progression: {
        inherentSkillsUnlocked: true,
        minorFortesUnlocked: true,
      },
      weapon: { weaponId: weapon.id, level: 90, rank: 1 },
    });
    expect(presets[0]?.echoLoadout?.echoes).toHaveLength(5);
    expect(
      presets[0]?.notes?.some((note) => note.includes("inclus exactement une fois dans finalStats")),
    ).toBe(true);
  });

  it("keeps every required native GameDatabase action exact at Lv1 and Lv10", () => {
    for (const id of Object.values(QIUYUAN_NATIVE)) {
      const action = resonator.combat?.actions.find((candidate) => candidate.id === id);
      expect(action, id).toBeDefined();
      expect(action?.multipliers.length, `${id} damage row`).toBeGreaterThan(0);
      expect(action?.multipliersByTalentLevel?.[1], `${id} Lv1`).toBeDefined();
      expect(action?.multipliersByTalentLevel?.[10], `${id} Lv10`).toBeDefined();
    }
  });

  it("keeps reviewed manual-only actions separate from native GameDatabase rows", () => {
    for (const id of Object.values(QIUYUAN_MANUAL)) {
      const action = resonator.combat?.actions.find((candidate) => candidate.id === id);
      expect(action, id).toBeDefined();
      expect(action?.multipliers.length, `${id} reviewed MV`).toBeGreaterThan(0);
    }
  });

  it("keeps Emerald Sentence permanent ATK upstream and Bamboo Cleaver/team Echo buffs runtime", () => {
    const permanent = weaponEffects.find(
      (effect) => effect.structuredEffect?.id === "precise-emerald-sentence-permanent",
    )?.structuredEffect;
    const bamboo = weaponEffects.find(
      (effect) => effect.structuredEffect?.id === "precise-emerald-sentence-bamboo-cleaver",
    )?.structuredEffect;
    const team = weaponEffects.find(
      (effect) => effect.structuredEffect?.id === "precise-emerald-sentence-intro-echo-bonus",
    )?.structuredEffect;

    expect(permanent?.activationPolicy).toBe("initially-active");
    expect(permanent?.rules).toHaveLength(1);
    expect(permanent?.rules[0]?.accounting).toBe("already-in-final-stats");
    expect(bamboo?.activationPolicy).toBe("triggered");
    expect(bamboo?.rules.every((rule) => rule.accounting === "runtime")).toBe(true);
    expect(team?.activationPolicy).toBe("triggered");
    expect(team?.rules.every((rule) => rule.accounting === "runtime")).toBe(true);
  });

  it("keeps recipient-owned Concerto and Outro handoffs explicit instead of inventing team state", () => {
    const pending = resonator.combat?.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-qiuyuan-team-cycle-pending",
    )?.structuredEffect;
    expect(pending?.teamContextRequired).toBe(true);
    expect(resonator.combat?.unknowns?.some((note) => note.includes("Team Cycle"))).toBe(true);
  });
});
