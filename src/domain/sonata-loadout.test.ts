import { describe, expect, it } from "vitest";
import type { Sonata } from "./models";
import type { UserEchoLoadoutV1 } from "./user-echo-loadout";
import {
  resolveActiveSonataSetIdsV1,
  resolveSonataLoadoutV1,
  resolveSonataSetsFromEchoLoadoutV1,
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
  it("resolves a 5-piece set without duplicating lower thresholds", () => {
    const resolved = resolveSonataSetsFromEchoLoadoutV1(
      loadout(["set:a", "set:a", "set:a", "set:a", "set:a"]),
    );

    expect(resolved).toEqual([
      {
        sonataSetId: "set:a",
        pieceCount: 5,
        reachedThresholds: [2, 3, 5],
      },
    ]);
    expect(resolveActiveSonataSetIdsV1(loadout(["set:a", "set:a", "set:a", "set:a", "set:a"]))).toEqual(["set:a"]);
  });

  it("resolves 3+2 as two independent sets and never invents a composite id", () => {
    const mixed = loadout(["dream", "dream", "dream", "midnight", "midnight"]);
    const resolved = resolveSonataSetsFromEchoLoadoutV1(mixed);

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
    expect(resolveActiveSonataSetIdsV1(mixed)).toEqual(["dream", "midnight"]);
  });

  it("maps only explicitly declared piece bonuses for a mixed set", () => {
    const resolved = resolveSonataLoadoutV1(
      loadout(["dream", "dream", "dream", "midnight", "midnight"]),
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

  it("never promotes legacy full-set effects for an Echo-derived mixed loadout", () => {
    const legacyOnly: Sonata = {
      id: "legacy",
      name: "Legacy",
      effects: [],
      source: fixtureSource,
    };
    const resolved = resolveSonataLoadoutV1(
      loadout(["legacy", "legacy", "other", "other", "other"]),
      [legacyOnly],
    );

    expect(resolved.activeSonatas[0]?.activePieceBonuses).toEqual([]);
    expect(resolved.activeSonatas[0]?.effects).toEqual([]);
    expect(resolved.unresolvedActiveSetIds).toEqual(["other"]);
  });

  it("resolves 2+2+1 while leaving the singleton inactive", () => {
    const mixed = loadout(["set:a", "set:a", "set:b", "set:b", "set:c"]);

    expect(resolveSonataSetsFromEchoLoadoutV1(mixed)).toEqual([
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
    expect(resolveActiveSonataSetIdsV1(mixed)).toEqual(["set:a", "set:b"]);
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
