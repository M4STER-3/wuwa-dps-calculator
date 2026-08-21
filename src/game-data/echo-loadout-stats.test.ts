import { describe, expect, it } from "vitest";

import type { FinalStats } from "@/domain/models";
import type { UserEchoLoadoutV1 } from "@/domain/user-echo-loadout";
import {
  applyEchoLoadoutStatsV1,
  replaceEchoLoadoutStatsV1,
} from "./echo-loadout-stats";

const panel: FinalStats = {
  hp: 15000,
  attack: 2000,
  defense: 1100,
  critRate: 65,
  critDamage: 210,
  energyRegen: 115,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: {
    aero: 0,
    glacio: 0,
    electro: 0,
    fusion: 40,
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
};

const basis = { hp: 11025, attack: 1012.5, defense: 1148.87 };
const loadout = (critDamage: number): UserEchoLoadoutV1 => ({
  echoes: [
    {
      echoId: "test-echo",
      sonataSetId: "test-sonata",
      rarity: 5,
      level: 25,
      primaryMainStatId: "echo-main-4-crit-rate",
      substats: [
        { statId: "echo-sub-crit-damage", value: critDamage },
        { statId: "echo-sub-attack-percent", value: 11.6 },
      ],
    },
  ],
  mainEchoId: "test-echo",
});

describe("Echo permanent stat replacement", () => {
  it("replaces exact rolls without accumulating the previous loadout", () => {
    const first = loadout(12.6);
    const second = loadout(21);
    const applied = applyEchoLoadoutStatsV1(panel, basis, first).finalStats;
    const replaced = replaceEchoLoadoutStatsV1(
      applied,
      basis,
      first,
      second,
    ).finalStats;
    const expected = applyEchoLoadoutStatsV1(panel, basis, second).finalStats;

    expect(replaced).toEqual(expected);
    expect(replaced.critRate).toBe(87);
    expect(replaced.critDamage).toBe(231);
  });

  it("can remove a detailed loadout and recover the exact pre-Echo panel", () => {
    const current = loadout(21);
    const applied = applyEchoLoadoutStatsV1(panel, basis, current).finalStats;
    const removed = replaceEchoLoadoutStatsV1(
      applied,
      basis,
      current,
      undefined,
    ).finalStats;

    expect(removed).toEqual(panel);
  });
});
