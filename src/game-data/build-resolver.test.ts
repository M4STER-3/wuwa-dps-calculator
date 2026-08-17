import { describe, expect, it } from "vitest";
import type {
  CharacterCatalogEntry,
  EchoCatalogEntry,
  GameDatabaseV1,
  NumericStatProgression,
  SonataSetCatalogEntry,
  WeaponCatalogEntry,
} from "./schema";
import type { EchoLoadoutV1 } from "./echo-loadout";
import { resolveExactBuildStatSheetV1 } from "./build-resolver";

const importedAt = "2026-08-17T00:00:00.000Z";
const source = (externalId: string) => ({
  provider: "encore" as const,
  externalId,
  language: "en",
  dataset: "Release" as const,
  importedAt,
  sourceHash: "a".repeat(64),
});

const progression = (
  points: NumericStatProgression["points"],
): NumericStatProgression => ({ points, interpolation: "none" });

const character: CharacterCatalogEntry = {
  kind: "character",
  id: "character:1001",
  externalIds: { encore: "1001", wuwa: "1001" },
  name: "Fixture Sword Character",
  source: source("1001"),
  rarity: 5,
  element: "fusion",
  weaponType: "sword",
  stats: {
    hp: progression([{ level: 90, value: 10_000 }]),
    attack: progression([{ level: 90, value: 400 }]),
    defense: progression([{ level: 90, value: 1_000 }]),
  },
  skills: [],
  sequences: [],
};

const weapon: WeaponCatalogEntry = {
  kind: "weapon",
  id: "weapon:2001",
  externalIds: { encore: "2001", wuwa: "2001" },
  name: "Fixture Sword",
  source: source("2001"),
  type: "sword",
  rarity: 5,
  baseStats: {
    attack: progression([{ level: 90, value: 600 }]),
    secondaryStat: {
      stat: "ATK",
      unit: "percentage-points",
      progression: progression([{ level: 90, value: 36.45 }]),
    },
  },
  passive: {
    name: "Fixture passive",
    description: "A permanent effect that is deliberately unresolved in V1.",
    ranks: [],
  },
};

const sonata: SonataSetCatalogEntry = {
  kind: "sonata-set",
  id: "sonata-set:1",
  externalIds: { encore: "1" },
  name: "Fixture Sonata",
  source: source("1"),
  bonuses: [
    { pieces: 2, description: "Fixture permanent two-piece effect." },
    { pieces: 5, description: "Fixture conditional five-piece effect." },
  ],
};

const echo = (id: number, cost: 1 | 3 | 4): EchoCatalogEntry => ({
  kind: "echo",
  id: `echo:${id}`,
  externalIds: { encore: String(id), wuwa: String(id) },
  name: `Fixture Echo ${id}`,
  source: source(String(id)),
  cost,
  sonataSetIds: [sonata.id],
});

const database: Pick<
  GameDatabaseV1,
  "characters" | "weapons" | "echoes" | "sonataSets"
> = {
  characters: [character],
  weapons: [weapon],
  echoes: [
    echo(4001, 4),
    echo(3001, 3),
    echo(3002, 3),
    echo(1001, 1),
    echo(1002, 1),
  ],
  sonataSets: [sonata],
};

function validEchoLoadout(): EchoLoadoutV1 {
  return {
    mainEchoId: "echo:4001",
    echoes: [
      {
        echoId: "echo:4001",
        sonataSetId: sonata.id,
        rarity: 5,
        level: 25,
        primaryMainStatId: "echo-main-4-crit-rate",
        substats: [
          { statId: "echo-sub-crit-damage", value: 21 },
          { statId: "echo-sub-attack-percent", value: 11.6 },
        ],
      },
      {
        echoId: "echo:3001",
        sonataSetId: sonata.id,
        rarity: 5,
        level: 25,
        primaryMainStatId: "echo-main-3-fusion-damage",
        substats: [{ statId: "echo-sub-crit-rate", value: 10.5 }],
      },
      {
        echoId: "echo:3002",
        sonataSetId: sonata.id,
        rarity: 5,
        level: 25,
        primaryMainStatId: "echo-main-3-attack-percent",
        substats: [{ statId: "echo-sub-energy-regen", value: 12.4 }],
      },
      {
        echoId: "echo:1001",
        sonataSetId: sonata.id,
        rarity: 5,
        level: 25,
        primaryMainStatId: "echo-main-1-attack-percent",
        substats: [{ statId: "echo-sub-attack-flat", value: 60 }],
      },
      {
        echoId: "echo:1002",
        sonataSetId: sonata.id,
        rarity: 5,
        level: 25,
        primaryMainStatId: "echo-main-1-hp-percent",
        substats: [
          { statId: "echo-sub-hp-flat", value: 580 },
          { statId: "echo-sub-resonance-skill-damage", value: 11.6 },
        ],
      },
    ],
  };
}

function validInput() {
  return {
    characterId: character.id,
    characterLevel: 90,
    weaponId: weapon.id,
    weaponLevel: 90,
    echoLoadout: validEchoLoadout(),
  };
}

describe("resolveExactBuildStatSheetV1", () => {
  it("combines reviewed character, weapon and Echo permanent stats exactly once", () => {
    const resolved = resolveExactBuildStatSheetV1(database, validInput());

    expect(resolved.exactBase.character).toEqual({ hp: 10_000, attack: 400, defense: 1_000 });
    expect(resolved.exactBase.weapon).toEqual({
      attack: 600,
      secondaryStat: { stat: "ATK", value: 36.45 },
    });
    expect(resolved.echoResolution.totalCost).toBe(12);
    expect(resolved.statSheet.hp).toBeCloseTo(17_420);
    expect(resolved.statSheet.attack).toBeCloseTo(2_370.5);
    expect(resolved.statSheet.defense).toBeCloseTo(1_000);
    expect(resolved.statSheet.critRate).toBeCloseTo(37.5);
    expect(resolved.statSheet.critDamage).toBeCloseTo(171);
    expect(resolved.statSheet.energyRegen).toBeCloseTo(112.4);
    expect(resolved.statSheet.elementalDamageBonus.fusion).toBeCloseTo(30);
    expect(resolved.statSheet.damageTypeBonus.resonanceSkill).toBeCloseTo(11.6);
    expect(resolved.complete).toBe(false);
    expect(resolved.unresolvedPermanentSources).toEqual([
      { kind: "character-permanent-nodes", characterId: character.id },
      { kind: "weapon-passive", weaponId: weapon.id },
      { kind: "sonata-bonus", sonataSetId: sonata.id, pieces: 2, description: "Fixture permanent two-piece effect." },
      { kind: "sonata-bonus", sonataSetId: sonata.id, pieces: 5, description: "Fixture conditional five-piece effect." },
    ]);
  });

  it("requires an explicit ascension side when a level has two exact source values", () => {
    const capCharacter: CharacterCatalogEntry = {
      ...character,
      stats: {
        hp: progression([{ level: 20, value: 2_000, ascended: false }, { level: 20, value: 2_400, ascended: true }]),
        attack: progression([{ level: 20, value: 100, ascended: false }, { level: 20, value: 120, ascended: true }]),
        defense: progression([{ level: 20, value: 200, ascended: false }, { level: 20, value: 230, ascended: true }]),
      },
    };
    const capDatabase = { ...database, characters: [capCharacter] };

    expect(() => resolveExactBuildStatSheetV1(capDatabase, { ...validInput(), characterLevel: 20 }))
      .toThrow(/requires an explicit pre\/post ascension choice/);

    const resolved = resolveExactBuildStatSheetV1(capDatabase, {
      ...validInput(),
      characterLevel: 20,
      characterAscended: true,
    });
    expect(resolved.exactBase.character).toEqual({ hp: 2_400, attack: 120, defense: 230 });
  });

  it("rejects an incompatible weapon and missing reviewed progressions", () => {
    const wrongWeapon: WeaponCatalogEntry = { ...weapon, type: "broadblade" };
    expect(() => resolveExactBuildStatSheetV1({ ...database, weapons: [wrongWeapon] }, validInput()))
      .toThrow(/incompatible/);

    const missingStats: CharacterCatalogEntry = { ...character, stats: undefined };
    expect(() => resolveExactBuildStatSheetV1({ ...database, characters: [missingStats] }, validInput()))
      .toThrow(/no reviewed non-interpolated progression/);
  });

  it("fails closed on an unreviewed weapon secondary-stat semantic", () => {
    const unknownSecondary: WeaponCatalogEntry = {
      ...weapon,
      baseStats: {
        ...weapon.baseStats,
        secondaryStat: {
          stat: "Unknown Future Stat",
          unit: "percentage-points",
          progression: progression([{ level: 90, value: 12 }]),
        },
      },
    };

    expect(() => resolveExactBuildStatSheetV1({ ...database, weapons: [unknownSecondary] }, validInput()))
      .toThrow(/no reviewed V1 semantic mapping/);
  });
});
