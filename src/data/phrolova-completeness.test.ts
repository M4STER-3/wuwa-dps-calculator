import { describe, expect, it } from "vitest";
import type { FinalStats, Sequence, UserBuild } from "@/domain/models";
import { preciseCharacterBoxPresets } from "./precise-character-box-presets";
import { preciseDpsFutureScenarios } from "./precise-dps-future";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";
import { PHROLOVA } from "./precise-dps-phrolova";
import { runPhrolovaContributionCycle } from "./precise-dps-phrolova-contribution";

const stats: FinalStats = {
  hp: 20000,
  attack: 2000,
  defense: 1137,
  critRate: 50,
  critDamage: 200,
  energyRegen: 100,
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
};

const resonator = findPreciseDpsResonator("phrolova")!;
const weapon = findPreciseDpsWeapon("phrolova")!;
const scenario = preciseDpsFutureScenarios.find(
  (entry) => entry.id === "phrolova-opener-boss",
)!;

const build = (sequence: Sequence): UserBuild => ({
  id: `phrolova-completeness-s${sequence}`,
  resonatorId: "phrolova",
  sourcePresetId: "phrolova-completeness",
  characterLevel: 90,
  sequence,
  skillLevels: {
    basicAttack: 10,
    resonanceSkill: 10,
    forteCircuit: 10,
    resonanceLiberation: 10,
    introSkill: 10,
  },
  weapon: { weaponId: weapon.id, level: 90, rank: 1 },
  finalStats: stats,
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
});

const run = (sequence: Sequence, initialAftersound?: number) =>
  runPhrolovaContributionCycle({
    scenario,
    resonator,
    build: build(sequence),
    stats,
    target: {
      level: 90,
      elementalResistance: { havoc: 0.1 },
      physicalResistance: 0.1,
    },
    weapon,
    baseStatBasis: {
      attack:
        (resonator.baseStats?.[0]?.attack ?? 0) +
        (weapon.level90Stats?.baseAttack ?? 0),
      hp: resonator.baseStats?.[0]?.hp,
      defense: resonator.baseStats?.[0]?.defense,
    },
    initialAftersound,
    teamEchoTriggers: [
      { timeSeconds: 2, echoName: "Echo Alpha", triggeringActorId: "ally-a" },
      { timeSeconds: 5, echoName: "Echo Beta", triggeringActorId: "ally-b" },
      { timeSeconds: 8, echoName: "Echo Gamma", triggeringActorId: "ally-a" },
    ],
  });

describe("Phrolova completion audit", () => {
  it("has the reviewed signature Character Box package", () => {
    const preset = preciseCharacterBoxPresets.find(
      (entry) => entry.resonatorId === "phrolova",
    );

    expect(resonator).toMatchObject({
      id: "phrolova",
      element: "havoc",
      rarity: 5,
    });
    expect(weapon).toMatchObject({
      name: "Lethean Elegy",
      rarity: 5,
      level90Stats: { baseAttack: 500 },
    });
    expect(preset).toMatchObject({
      resonatorId: "phrolova",
      characterLevel: 90,
      sequence: 0,
      progression: {
        inherentSkillsUnlocked: true,
        minorFortesUnlocked: true,
      },
      weapon: { weaponId: weapon.id, level: 90, rank: 1 },
    });
    expect(preset?.echoLoadout?.echoes).toHaveLength(5);
    expect(preset?.mainEchoId).toBeDefined();
  });

  it("keeps exact Lv1-Lv10 GameDatabase damage rows on the native Phrolova actions", () => {
    const nativeIds = [
      PHROLOVA.basic1,
      PHROLOVA.basic2,
      PHROLOVA.basic3,
      PHROLOVA.scarletCoda,
      PHROLOVA.whispers,
      PHROLOVA.hecateBasic1,
      PHROLOVA.hecateBasic2,
      PHROLOVA.hecateStrings,
      PHROLOVA.hecateWinds,
      PHROLOVA.hecateCadenza,
      PHROLOVA.curtainCall,
      PHROLOVA.suiteQuietus,
      PHROLOVA.suiteImmortality,
      PHROLOVA.movement,
      PHROLOVA.murmurs,
    ];

    for (const id of nativeIds) {
      const action = resonator.combat?.actions.find((entry) => entry.id === id);
      expect(action, id).toBeDefined();
      expect(action?.multipliersByTalentLevel?.[1], `${id} Lv1`).toBeDefined();
      expect(action?.multipliersByTalentLevel?.[10], `${id} Lv10`).toBeDefined();
    }
  });

  it("produces a complete 25s S0 contribution cycle when exact teammate Echo events are supplied", () => {
    const result = run(0);
    expect(result.partial, JSON.stringify(result.diagnostics)).toBe(false);
    expect(result.cycleDurationSeconds).toBe(25);
    expect(result.onField.personalDamage.expected).toBeGreaterThan(0);
    expect(result.offField.personalDamage.expected).toBeGreaterThan(0);
    expect(result.totalDamage.expected).toBeGreaterThan(
      result.onField.personalDamage.expected,
    );
  });

  it("keeps the S6 carry contract explicit and executes the full cycle when 24 Aftersound is carried", () => {
    const withoutCarry = run(6);
    expect(withoutCarry.partial).toBe(true);
    expect(
      withoutCarry.diagnostics.some((diagnostic) =>
        diagnostic.includes("aftersound-carry-required"),
      ),
    ).toBe(true);

    const result = run(6, 24);
    expect(result.partial, JSON.stringify(result.diagnostics)).toBe(false);
    expect(result.totalDamage.expected).toBeGreaterThan(run(0).totalDamage.expected);
    expect(result.offField.perAction[PHROLOVA.apparition]?.expected ?? 0).toBeGreaterThan(0);
  });
});
