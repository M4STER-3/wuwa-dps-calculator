import { describe, expect, it } from "vitest";

import { createBuildFromPreset } from "@/domain/character-box";
import {
  calculateActionLab,
  isStandardDamage,
  resolvePersonalLoadout,
} from "@/domain/personal-dps-lab";
import { verinaPreset } from "./verina-complete";

const target = {
  id: "verina-wutheringtools-target",
  level: 90,
  elementalResistance: { spectro: 0.1 },
  physicalResistance: 0.1,
  tuneEnemyClass: "4C" as const,
};

const display = (result: { total: { nonCrit: number; expected: number; crit: number } }) => [
  Math.ceil(result.total.nonCrit),
  Math.ceil(result.total.expected),
  Math.ceil(result.total.crit),
];

const loadoutAtSequence = (sequence: 0 | 4 | 6) => {
  const build = createBuildFromPreset(
    { ...verinaPreset, sequence },
    {
      id: `verina-wutheringtools-s${sequence}`,
      now: "2026-08-21T00:50:00+02:00",
    },
  );
  return { build, loadout: resolvePersonalLoadout(build) };
};

// Independent reference arithmetic uses the formula published by WutheringTools:
// totalAttack * MV * totalAmplify * totalDamageBonus * crit * DEF * RES.
// Reference checked 2026-08-21 against https://www.wutheringtools.com/info.
// These are formula-parity fixtures, not transcribed live UI outputs.
describe("WutheringTools formula parity — Verina multi-config", () => {
  it("matches the S0 permanent-panel Botany Experiment reference", () => {
    const { build, loadout } = loadoutAtSequence(0);
    const result = calculateActionLab({
      loadout,
      actionId: "verina-botany-experiment",
      stats: build.finalStats,
      target,
    })!;
    if (!isStandardDamage(result.damage)) {
      throw new Error("Expected standard Botany Experiment damage");
    }

    // ATK = (337.5 + 337) * 1.12 = 755.44
    // MV = 35.79% * 3 + 71.58% = 178.95%
    expect(display(result.damage)).toEqual([610, 626, 915]);
  });

  it("matches S4 with Gift, Rejuvenating Glow, Fallacy and Spectro team buff", () => {
    const { build, loadout } = loadoutAtSequence(4);
    const result = calculateActionLab({
      loadout,
      actionId: "verina-botany-experiment",
      stats: build.finalStats,
      target,
      manualEffectIds: [
        "verina-gift-of-nature-team",
        "rejuvenating-glow-5pc-team",
        "fallacy-team-atk",
        "verina-s4-spectro-team",
      ],
    })!;
    if (!isStandardDamage(result.damage)) {
      throw new Error("Expected standard S4 Botany Experiment damage");
    }

    // Total ATK% = 12 permanent + 20 Gift + 15 Rejuvenating + 10 Fallacy = 57%.
    // Effective ATK = (337.5 + 337) * 1.57 = 1058.965; Spectro bonus = 15%.
    expect(result.damage.additionalElementalDamageBonusPercent).toBe(15);
    expect(display(result.damage)).toEqual([984, 1008, 1475]);
  });

  it("matches S6 Starflower after the same team buffs plus Joyous Harvest", () => {
    const { build, loadout } = loadoutAtSequence(6);
    const result = calculateActionLab({
      loadout,
      actionId: "verina-starflower-heavy",
      stats: build.finalStats,
      target,
      manualEffectIds: [
        "verina-gift-of-nature-team",
        "rejuvenating-glow-5pc-team",
        "fallacy-team-atk",
        "verina-s4-spectro-team",
        "verina-s6-joyous-harvest",
      ],
    })!;
    if (!isStandardDamage(result.damage)) {
      throw new Error("Expected standard S6 Starflower damage");
    }

    // Base MV 64.95% + 97.42% = 162.37%; S6 is a +20% relative MV multiplier.
    expect(result.damage.totalMotionValue * 100).toBeCloseTo(194.844, 9);
    expect(display(result.damage)).toEqual([1071, 1098, 1606]);
  });

  it("keeps Fallacy HP scaling independent from ATK buffs while S4 Spectro still applies", () => {
    const { build, loadout } = loadoutAtSequence(4);
    const baseline = calculateActionLab({
      loadout,
      actionId: "fallacy-blast",
      stats: build.finalStats,
      target,
    })!;
    const buffed = calculateActionLab({
      loadout,
      actionId: "fallacy-blast",
      stats: build.finalStats,
      target,
      manualEffectIds: [
        "verina-gift-of-nature-team",
        "rejuvenating-glow-5pc-team",
        "fallacy-team-atk",
        "verina-s4-spectro-team",
      ],
    })!;
    if (!isStandardDamage(baseline.damage) || !isStandardDamage(buffed.damage)) {
      throw new Error("Expected standard Fallacy damage");
    }

    expect(display(baseline.damage)).toEqual([1019, 1045, 1529]);
    expect(display(buffed.damage)).toEqual([1172, 1201, 1758]);
  });
});
