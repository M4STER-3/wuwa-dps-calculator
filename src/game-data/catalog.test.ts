import { describe, expect, it } from "vitest";
import { createGameCatalog } from "./catalog";
import type { GameDatabaseV1, GeneratedSourceMetadata } from "./schema";

const source = (externalId: string): GeneratedSourceMetadata => ({
  provider: "encore",
  externalId,
  language: "en",
  dataset: "Release",
  importedAt: "2026-08-17T00:00:00.000Z",
  sourceHash: `hash-${externalId}`,
});

function database(): GameDatabaseV1 {
  return {
    manifest: {
      schemaVersion: 1,
      dataset: "Release",
      generatedAt: "2026-08-17T00:00:00.000Z",
      sourceProvider: "encore",
      sourceImportedAt: "2026-08-17T00:00:00.000Z",
      counts: { characters: 1, weapons: 1, echoes: 1, sonataSets: 1 },
    },
    characters: [
      {
        kind: "character",
        id: "example-character",
        externalIds: { encore: "1001", wuwa: "1001" },
        name: "Example Character",
        rarity: 5,
        element: "spectro",
        weaponType: "rectifier",
        skills: [],
        sequences: [],
        source: source("1001"),
      },
    ],
    weapons: [
      {
        kind: "weapon",
        id: "example-weapon",
        externalIds: { encore: "2001", wuwa: "2001" },
        name: "Example Weapon",
        type: "rectifier",
        rarity: 5,
        baseStats: {},
        source: source("2001"),
      },
    ],
    sonataSets: [
      {
        kind: "sonata-set",
        id: "example-sonata",
        externalIds: { encore: "3001" },
        name: "Example Sonata",
        bonuses: [{ pieces: 2, description: "Example bonus" }],
        source: source("3001"),
      },
    ],
    echoes: [
      {
        kind: "echo",
        id: "example-echo",
        externalIds: { encore: "4001", wuwa: "4001" },
        name: "Example Echo",
        cost: 4,
        sonataSetIds: ["example-sonata"],
        source: source("4001"),
      },
    ],
  };
}

describe("GameCatalog", () => {
  it("resolves canonical and Encore ids without using display names", () => {
    const catalog = createGameCatalog(database());
    expect(catalog.valid).toBe(true);
    expect(catalog.characters.get("example-character")?.name).toBe("Example Character");
    expect(catalog.characters.byEncoreId("1001")?.id).toBe("example-character");
    expect(catalog.echoes.forSonata("example-sonata").map((echo) => echo.id)).toEqual(["example-echo"]);
    expect(catalog.weapons.forType("rectifier").map((weapon) => weapon.id)).toEqual(["example-weapon"]);
  });

  it("reports duplicate ids and broken references instead of silently accepting them", () => {
    const value = database();
    const broken: GameDatabaseV1 = {
      ...value,
      manifest: {
        ...value.manifest,
        counts: { ...value.manifest.counts, echoes: 3 },
      },
      echoes: [
        ...value.echoes,
        { ...value.echoes[0], id: "example-echo-2" },
        { ...value.echoes[0], id: "broken-echo", externalIds: { encore: "4002" }, sonataSetIds: ["missing-sonata"] },
      ],
    };

    const catalog = createGameCatalog(broken);
    expect(catalog.valid).toBe(false);
    expect(catalog.diagnostics.map((item) => item.code)).toContain("duplicate-encore-id");
    expect(catalog.diagnostics.map((item) => item.code)).toContain("unknown-sonata-reference");
  });
});
