import { describe, expect, it } from "vitest";
import type { UserEchoLoadoutV1 } from "./user-echo-loadout";
import {
  resolveActiveSonataSetIdsV1,
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
    const resolved = resolveSonataSetsFromEchoLoadoutV1(
      loadout(["dream", "dream", "dream", "midnight", "midnight"]),
    );

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
    expect(resolveActiveSonataSetIdsV1(loadout(["dream", "dream", "dream", "midnight", "midnight"]))).toEqual(["dream", "midnight"]);
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
  });
});
