import { describe, expect, it } from "vitest";
import { generateGameDatabaseV1 } from "../../scripts/lib/game-database-generator.mjs";
import { createGameCatalog } from "./catalog";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function classifiedSnapshot() {
  return {
    schemaVersion: 1,
    sourceProvider: "encore",
    language: "en",
    dataset: "Release",
    sourceImportedAt: "2026-08-17T00:00:00.000Z",
    counts: { characters: 1, weapons: 1, echoes: 1, sonataSets: 1 },
    sourceHashes: {
      characters: { "1001": HASH_A },
      weapons: { "2001": HASH_B },
      echoes: { "3001": HASH_C },
    },
    characters: [
      {
        sourceId: "1001",
        name: "Contract Resonator",
        element: "Spectro",
        weaponType: "Sword",
        rarity: 5,
        maxLevel: 90,
        properties: [],
        skills: [
          {
            sourceSkillId: "skill-1",
            name: "Contract Skill",
            type: "Resonance Skill",
            description: "Contract skill description.",
            attributes: [],
          },
        ],
        resonanceChain: [1, 2, 3, 4, 5, 6].map((sequence) => ({
          sequence,
          sourceNodeId: `node-${sequence}`,
          name: `Sequence ${sequence}`,
          description: `Sequence ${sequence} description.`,
        })),
        permanentPropertyNodes: [],
      },
    ],
    weapons: [
      {
        sourceId: "2001",
        name: "Contract Sword",
        weaponType: "Sword",
        rarity: 5,
        properties: [],
        breaches: [],
      },
    ],
    echoes: [
      {
        sourceId: "3001",
        sourceItemId: "60000015",
        name: "Contract Echo",
        qualityId: 5,
        sourceRarity: 0,
        levelUpGroupId: 4,
        sourceSonataGroupIds: [9001],
        sourcePhantomType: 1,
        sourceMainPropRandGroupId: 503,
        catalogState: "base",
        cost: 1,
        skill: {
          sourceSkillId: "echo-skill-1",
          description: "Contract Echo description.",
          cooldownSeconds: 15,
        },
      },
    ],
    sonataSets: [
      {
        sourceId: "9001",
        name: "Contract Sonata",
        bonuses: [{ pieces: 2, description: "Contract Sonata bonus." }],
      },
    ],
    diagnostics: [],
  };
}

describe("generated GameDatabase V1 contract", () => {
  it("produces a catalog-valid database without rebuilding unresolved stat curves", () => {
    const { database, report } = generateGameDatabaseV1(classifiedSnapshot());
    const catalog = createGameCatalog(database);

    expect(catalog.valid).toBe(true);
    expect(catalog.diagnostics).toEqual([]);
    expect(database.manifest.counts).toEqual({
      characters: 1,
      weapons: 1,
      echoes: 1,
      sonataSets: 1,
    });
    expect(catalog.characters.byEncoreId("1001")?.kind).toBe("character");
    expect(catalog.weapons.byEncoreId("2001")?.baseStats).toEqual({});
    expect(catalog.echoes.byEncoreId("3001")?.cost).toBe(1);
    expect(catalog.echoes.forCost(1)).toHaveLength(1);
    expect(catalog.echoes.forSonata("sonata-set:9001")).toHaveLength(1);
    expect(catalog.sonataSets.byEncoreId("9001")?.name).toBe("Contract Sonata");
    expect(database.characters[0].stats).toBeUndefined();
    expect(database.weapons[0].baseStats.attack).toBeUndefined();
    expect(report.unresolved).toContain("character level/stat growth source-index mapping");
    expect(report.unresolved).toContain("weapon level/stat growth source-index mapping");
  });
});
