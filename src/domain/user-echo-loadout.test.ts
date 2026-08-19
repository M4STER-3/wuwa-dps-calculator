import { describe, expect, it } from "vitest";
import { presets } from "@/data/catalog";
import type { EchoLoadoutV1 as ResolverEchoLoadoutV1 } from "@/game-data/echo-loadout";
import {
  createBuildFromPreset,
  emptyCharacterBox,
  parseCharacterBox,
} from "./character-box";
import type { UserEchoLoadoutV1 } from "./user-echo-loadout";
import { isUserEchoLoadoutV1 } from "./user-echo-loadout";

const preset = presets.find((candidate) => candidate.resonatorId === "aemeath")!;

const loadout: UserEchoLoadoutV1 = {
  echoes: [
    {
      echoId: "echo:1001",
      sonataSetId: "sonata:2001",
      rarity: 5,
      level: 25,
      primaryMainStatId: "cost4:crit-rate",
      substats: [
        { statId: "crit-rate", value: 10.5 },
        { statId: "attack-percent", value: 11.6 },
      ],
    },
    {
      echoId: "echo:1002",
      sonataSetId: "sonata:2001",
      rarity: 5,
      level: 25,
      primaryMainStatId: "cost3:fusion-dmg",
      substats: [{ statId: "crit-damage", value: 21 }],
    },
  ],
  mainEchoId: "echo:1001",
};

function buildWithLoadout(echoLoadout: UserEchoLoadoutV1 = loadout) {
  return {
    ...createBuildFromPreset(preset, {
      id: "build-echo-persistence",
      now: "2026-08-17T18:00:00.000Z",
    }),
    echoLoadout,
  };
}

describe("User Echo Loadout V1 persistence", () => {
  it("reste structurellement compatible avec l'entrée du resolver Echo V1", () => {
    const resolverInput: ResolverEchoLoadoutV1 = loadout;
    expect(resolverInput).toBe(loadout);
  });

  it("persiste le loadout sans recalculer finalStats", () => {
    const build = buildWithLoadout();
    const parsed = parseCharacterBox(
      JSON.stringify({ schemaVersion: 1, builds: [build] }),
    );

    expect(parsed.builds).toHaveLength(1);
    expect(parsed.builds[0].echoLoadout).toEqual(loadout);
    expect(parsed.builds[0].finalStats).toEqual(build.finalStats);
  });

  it("supprime les propriétés inconnues à tous les niveaux du loadout", () => {
    const build = buildWithLoadout();
    const serialized = JSON.stringify({
      schemaVersion: 1,
      builds: [
        {
          ...build,
          echoLoadout: {
            ...loadout,
            untrustedLoadoutField: "ignored",
            echoes: loadout.echoes.map((echo, index) => ({
              ...echo,
              untrustedEchoField: "ignored",
              substats: echo.substats.map((substat) => ({
                ...substat,
                untrustedSubstatField: index,
              })),
            })),
          },
        },
      ],
    });

    const restored = parseCharacterBox(serialized).builds[0]!;
    const restoredLoadout = restored.echoLoadout as unknown as Record<string, unknown>;
    const restoredEcho = (restoredLoadout.echoes as Record<string, unknown>[])[0]!;
    const restoredSubstat = (restoredEcho.substats as Record<string, unknown>[])[0]!;

    expect(restored.echoLoadout).toEqual(loadout);
    expect("untrustedLoadoutField" in restoredLoadout).toBe(false);
    expect("untrustedEchoField" in restoredEcho).toBe(false);
    expect("untrustedSubstatField" in restoredSubstat).toBe(false);
  });

  it("refuse les formes structurellement dangereuses ou ambiguës", () => {
    const invalidLoadouts: unknown[] = [
      { ...loadout, echoes: [...loadout.echoes, ...loadout.echoes, ...loadout.echoes] },
      { ...loadout, echoes: [loadout.echoes[0], loadout.echoes[0]] },
      { ...loadout, mainEchoId: "echo:not-equipped" },
      {
        echoes: [
          {
            ...loadout.echoes[0],
            substats: [
              { statId: "crit-rate", value: 10.5 },
              { statId: "crit-rate", value: 9.3 },
            ],
          },
        ],
      },
      { echoes: [{ ...loadout.echoes[0], rarity: 4 }] },
      { echoes: [{ ...loadout.echoes[0], level: 24 }] },
      { echoes: [{ ...loadout.echoes[0], echoId: "x".repeat(201) }] },
      { echoes: [{ ...loadout.echoes[0], substats: [{ statId: "atk", value: -1 }] }] },
    ];

    for (const invalid of invalidLoadouts) {
      expect(isUserEchoLoadoutV1(invalid)).toBe(false);
      const parsed = parseCharacterBox(
        JSON.stringify({
          schemaVersion: 1,
          builds: [{ ...buildWithLoadout(), echoLoadout: invalid }],
        }),
      );
      expect(parsed).toEqual(emptyCharacterBox());
    }
  });

  it("reste rétrocompatible avec une Character Box sans echoLoadout", () => {
    const legacyBuild = createBuildFromPreset(preset, {
      id: "legacy-build",
      now: "2026-08-17T18:00:00.000Z",
    });
    delete legacyBuild.echoLoadout;
    const parsed = parseCharacterBox(
      JSON.stringify({ schemaVersion: 1, builds: [legacyBuild] }),
    );

    expect(parsed.builds[0]).toEqual(legacyBuild);
    expect(parsed.builds[0].echoLoadout).toBeUndefined();
  });
});