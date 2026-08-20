import { describe, expect, it } from "vitest";
import type { Sonata } from "./models";
import type { UserEchoLoadoutV1 } from "./user-echo-loadout";
import {
  countSonataPiecesFromEchoLoadoutV1,
  resolveActiveSonataSetIdsFromPieceCountsV1,
  resolveActiveSonataSetIdsV1,
  resolveSonataLoadoutFromPieceCountsV1,
  resolveSonataLoadoutV1,
  resolveSonataSetsFromEchoLoadoutV1,
  resolveSonataSetsFromPieceCountsV1,
} from "./sonata-loadout";

const echo = (
  echoId: string,
  sonataSetId: string,
): UserEchoLoadoutV1["echoes"][number] => ({
  echoId,
  sonataSetId,
  rarity: 5,
  level: 25,
  primaryMainStatId: "cost1:attack-percent",
  substats: [],
});

const loadout = (
  sets: readonly string[],
): UserEchoLoadoutV1 => ({
  echoes: sets.map((setId, index) => echo(`echo:${index + 1}`, setId)),
});

const fixtureSource = {
  kind: "technical-fixture" as const,
  source: "Sonata resolver fixture",
};

const sonataCatalog: readonly Sonata[] = [
  {
    id: "dream",
    name: "Dream",
    pieceBonuses: [
      { pieces: 2, effectDescription: "Dream 2p" },
      { pieces: 3, effectDescription: "Dream 3p" },
      { pieces: 5, effectDescription: "Dream 5p" },
    ],
    source: fixtureSource,
  },
  {
    id: "midnight",
    name: "Midnight",
    pieceBonuses: [
      { pieces: 2, effectDescription: "Midnight 2p" },
      { pieces: 5, effectDescription: "Midnight 5p" },
    ],
    source: fixtureSource,
  },
];

describe("Sonata resolver from equipped Echo pieces", () => {
  it("resolves a 5-piece validated count without duplicating lower thresholds", () => {
    const resolved = resolveSonataSetsFromPieceCountsV1({ "set:a": 5 });

    expect(resolved).toEqual([
      {
        sonataSetId: "set:a",
        pieceCount: 5,
        reachedThresholds: [2, 3, 5],
      },
    ]);
    expect(resolveActiveSonataSetIdsFromPieceCountsV1({ "set:a": 5 })).toEqual(["set:a"]);
  });

  it("resolves validated 3+2 counts as two independent sets and never invents a composite id", () => {
    const counts = { dream: 3, midnight: 2 };
    const resolved = resolveSonataSetsFromPieceCountsV1(counts);

    expect(resolved).toEqual([
      {
        sonataSetId: "dream",
        pieceCount: 3,
        reachedThresholds: [2, 3],
      },
      {
        sonataSetId: "midnight",
        pieceCount: 2,
        reachedThresholds: [2],
      },
    ]);
    expect(resolveActiveSonataSetIdsFromPieceCountsV1(counts)).toEqual(["dream", "midnight"]);
  });

  it("keeps persisted-loadout counting as a compatibility adapter to the validated-count resolver", () => {
    const mixed = loadout(["dream", "dream", "dream", "midnight", "midnight"]);
    const counts = countSonataPiecesFromEchoLoadoutV1(mixed);

    expect({ ...counts }).toEqual({ dream: 3, midnight: 2 });
    expect(resolveSonataSetsFromEchoLoadoutV1(mixed)).toEqual(
      resolveSonataSetsFromPieceCountsV1(counts),
    );
    expect(resolveActiveSonataSetIdsV1(mixed)).toEqual(
      resolveActiveSonataSetIdsFromPieceCountsV1(counts),
    );
  });

  it("maps only explicitly declared piece bonuses for a mixed set", () => {
    const resolved = resolveSonataLoadoutFromPieceCountsV1(
      { dream: 3, midnight: 2 },
      sonataCatalog,
    );

    expect(resolved.unresolvedActiveSetIds).toEqual([]);
    expect(
      resolved.activeSonatas.map((entry) => ({
        id: entry.sonata.id,
        pieceCount: entry.pieceCount,
        bonuses: entry.activePieceBonuses.map((bonus) => bonus.pieces),
      })),
    ).toEqual([
      { id: "dream", pieceCount: 3, bonuses: [2, 3] },
      { id: "midnight", pieceCount: 2, bonuses: [2] },
    ]);
  });

  it("keeps raw-loadout Sonata mapping equivalent to canonical validated counts", () => {
    const mixed = loadout(["dream", "dream", "dream", "midnight", "midnight"]);

    expect(resolveSonataLoadoutV1(mixed, sonataCatalog)).toEqual(
      resolveSonataLoadoutFromPieceCountsV1({ dream: 3, midnight: 2 }, sonataCatalog),
    );
  });

  it("never promotes legacy full-set effects for an Echo-derived mixed loadout", () => {
    const legacyOnly: Sonata = {
      id: "legacy",
      name: "Legacy",
      effects: [],
      source: fixtureSource,
    };
    const resolved = resolveSonataLoadoutFromPieceCountsV1(
      { legacy: 2, other: 3 },
      [legacyOnly],
    );

    expect(resolved.activeSonatas[0]?.activePieceBonuses).toEqual([]);
    expect(resolved.activeSonatas[0]?.effects).toEqual([]);
    expect(resolved.unresolvedActiveSetIds).toEqual(["other"]);
  });

  it("resolves 2+2+1 while leaving the singleton inactive", () => {
    const counts = { "set:a": 2, "set:b": 2, "set:c": 1 };

    expect(resolveSonataSetsFromPieceCountsV1(counts)).toEqual([
      {
        sonataSetId: "set:a",
        pieceCount: 2,
        reachedThresholds: [2],
      },
      {
        sonataSetId: "set:b",
        pieceCount: 2,
        reachedThresholds: [2],
      },
      {
        sonataSetId: "set:c",
        pieceCount: 1,
        reachedThresholds: [],
      },
    ]);
    expect(resolveActiveSonataSetIdsFromPieceCountsV1(counts)).toEqual(["set:a", "set:b"]);
  });

  it("ignores invalid non-positive or fractional count entries defensively", () => {
    expect(
      resolveSonataSetsFromPieceCountsV1({ active: 2, zero: 0, negative: -1, fractional: 2.5 }),
    ).toEqual([
      {
        sonataSetId: "active",
        pieceCount: 2,
        reachedThresholds: [2],
      },
    ]);
  });

  it("returns no active Sonata for a missing or empty Echo loadout", () => {
    expect(resolveSonataSetsFromEchoLoadoutV1(undefined)).toEqual([]);
    expect(resolveActiveSonataSetIdsV1({ echoes: [] })).toEqual([]);
    expect(resolveSonataLoadoutV1(undefined, sonataCatalog)).toEqual({
      sets: [],
      activeSonatas: [],
      unresolvedActiveSetIds: [],
    });
  });
});
