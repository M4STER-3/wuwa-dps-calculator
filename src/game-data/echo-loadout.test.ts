import { describe, expect, it } from "vitest";
import type { EchoCatalogEntry, GameDatabaseV1, SonataSetCatalogEntry } from "./schema";
import type { EchoLoadoutV1 } from "./echo-loadout";
import { resolveEchoLoadoutV1 } from "./echo-loadout";

const importedAt = "2026-08-17T00:00:00.000Z";
const source = (externalId: string) => ({
  provider: "encore" as const,
  externalId,
  language: "en",
  dataset: "Release" as const,
  importedAt,
  sourceHash: externalId.padStart(64, "a").slice(-64).replace(/[^a-f0-9]/g, "a"),
});

const sonata: SonataSetCatalogEntry = {
  kind: "sonata-set",
  id: "sonata-set:1",
  externalIds: { encore: "1" },
  name: "Fixture Sonata",
  source: source("1"),
  bonuses: [{ pieces: 5, description: "Fixture only." }],
};

const echo = (id: number, cost: 1 | 3 | 4): EchoCatalogEntry => ({
  kind: "echo",
  id: `echo:${id}`,
  externalIds: { encore: String(id) },
  name: `Fixture Echo ${id}`,
  source: source(String(id)),
  cost,
  sonataSetIds: [sonata.id],
});

const database: Pick<GameDatabaseV1, "echoes" | "sonataSets"> = {
  echoes: [echo(4001, 4), echo(3001, 3), echo(3002, 3), echo(1001, 1), echo(1002, 1), echo(4002, 4)],
  sonataSets: [sonata],
};

function validLoadout(): EchoLoadoutV1 {
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

const mutableClone = <T,>(value: T): T => structuredClone(value);

describe("resolveEchoLoadoutV1", () => {
  it("resolves an exact 4-3-3-1-1 endgame loadout without touching finalStats", () => {
    const resolved = resolveEchoLoadoutV1(database, validLoadout());
    expect(resolved.totalCost).toBe(12);
    expect(resolved.mainEchoId).toBe("echo:4001");
    expect(resolved.sonataPieceCounts).toEqual({ [sonata.id]: 5 });
    expect(resolved.contributions.flat).toEqual({ hp: 5140, attack: 410, defense: 0 });
    expect(resolved.contributions.basePercent.hp).toBeCloseTo(22.8);
    expect(resolved.contributions.basePercent.attack).toBeCloseTo(59.6);
    expect(resolved.contributions.basePercent.defense).toBe(0);
    expect(resolved.contributions.percentagePoints.critRate).toBeCloseTo(32.5);
    expect(resolved.contributions.percentagePoints.critDamage).toBe(21);
    expect(resolved.contributions.percentagePoints.energyRegen).toBeCloseTo(12.4);
    expect(resolved.contributions.percentagePoints.elementalDamageBonus.fusion).toBe(30);
    expect(resolved.contributions.percentagePoints.damageTypeBonus.resonanceSkill).toBeCloseTo(11.6);
  });

  it("rejects impossible cost, main-stat, Sonata and roll combinations", () => {
    const overCost = mutableClone(validLoadout());
    overCost.echoes[4] = {
      ...overCost.echoes[4]!,
      echoId: "echo:4002",
      primaryMainStatId: "echo-main-4-attack-percent",
    };
    expect(() => resolveEchoLoadoutV1(database, overCost)).toThrow(/cost exceeds 12/);

    const badMain = mutableClone(validLoadout());
    badMain.echoes[3]!.primaryMainStatId = "echo-main-4-crit-rate";
    expect(() => resolveEchoLoadoutV1(database, badMain)).toThrow(/invalid 1-cost main stat/);

    const badSonata = mutableClone(validLoadout());
    badSonata.echoes[0]!.sonataSetId = "sonata-set:999";
    expect(() => resolveEchoLoadoutV1(database, badSonata)).toThrow(/cannot have/);

    const impossibleRoll = mutableClone(validLoadout());
    impossibleRoll.echoes[0]!.substats[0]!.value = 20.9;
    expect(() => resolveEchoLoadoutV1(database, impossibleRoll)).toThrow(/impossible roll/);
  });

  it("rejects duplicated Echo types and duplicated substats in V1", () => {
    const duplicateEcho = mutableClone(validLoadout());
    duplicateEcho.echoes[4] = {
      ...duplicateEcho.echoes[4]!,
      echoId: "echo:1001",
    };
    expect(() => resolveEchoLoadoutV1(database, duplicateEcho)).toThrow(/duplicates Echo/);

    const duplicateSubstat = mutableClone(validLoadout());
    duplicateSubstat.echoes[0]!.substats = [
      { statId: "echo-sub-crit-rate", value: 10.5 },
      { statId: "echo-sub-crit-rate", value: 9.9 },
    ];
    expect(() => resolveEchoLoadoutV1(database, duplicateSubstat)).toThrow(/duplicates substat/);
  });

  it("rejects unsupported rarity/level and a main Echo that is not equipped", () => {
    const badLevel = mutableClone(validLoadout()) as unknown as {
      echoes: Array<Record<string, unknown>>;
      mainEchoId?: string;
    };
    badLevel.echoes[0]!.level = 20;
    expect(() => resolveEchoLoadoutV1(database, badLevel as unknown as EchoLoadoutV1)).toThrow(/unsupported level/);

    const badRarity = mutableClone(validLoadout()) as unknown as {
      echoes: Array<Record<string, unknown>>;
      mainEchoId?: string;
    };
    badRarity.echoes[0]!.rarity = 4;
    expect(() => resolveEchoLoadoutV1(database, badRarity as unknown as EchoLoadoutV1)).toThrow(/unsupported rarity/);

    const badMainEcho = mutableClone(validLoadout());
    badMainEcho.mainEchoId = "echo:9999";
    expect(() => resolveEchoLoadoutV1(database, badMainEcho)).toThrow(/is not equipped/);
  });
});
