import { describe, expect, it } from "vitest";
import { presets } from "@/data/catalog";
import { createBuildFromPreset, emptyCharacterBox } from "@/domain/character-box";
import type { UserEchoLoadoutV1 } from "@/domain/user-echo-loadout";
import {
  clearBuildEchoLoadout,
  draftSlotsFromLoadout,
  emptyEchoDraftSlots,
  loadoutFromDraftSlots,
  replaceBuildEchoLoadout,
} from "./echo-editor-state";

const preset = presets.find((candidate) => candidate.resonatorId === "aemeath")!;
const now = "2026-08-17T18:30:00.000Z";

const loadout: UserEchoLoadoutV1 = {
  mainEchoId: "echo:main",
  echoes: [
    {
      echoId: "echo:secondary",
      sonataSetId: "sonata:one",
      rarity: 5,
      level: 25,
      primaryMainStatId: "echo-main-1-attack-percent",
      substats: [{ statId: "echo-sub-attack-flat", value: 60 }],
    },
    {
      echoId: "echo:main",
      sonataSetId: "sonata:one",
      rarity: 5,
      level: 25,
      primaryMainStatId: "echo-main-4-crit-rate",
      substats: [{ statId: "echo-sub-crit-damage", value: 21 }],
    },
  ],
};

function boxWithBuild() {
  const build = createBuildFromPreset(preset, { id: "build:one", now });
  return { ...emptyCharacterBox(), builds: [build] };
}

describe("Echo editor persistence helpers", () => {
  it("loads the persisted main Echo into slot one and round-trips exact roll values", () => {
    const slots = draftSlotsFromLoadout(loadout);
    expect(slots).toHaveLength(5);
    expect(slots[0]?.echoId).toBe("echo:main");
    expect(slots[0]?.substats[0]).toEqual({ statId: "echo-sub-crit-damage", value: "21" });

    const roundTrip = loadoutFromDraftSlots(slots);
    expect(roundTrip.mainEchoId).toBe("echo:main");
    expect(roundTrip.echoes[0]?.substats[0]?.value).toBe(21);
    expect(roundTrip.echoes.map((echo) => echo.echoId)).toEqual(["echo:main", "echo:secondary"]);
  });

  it("does not invent a Main Echo when slot one is empty", () => {
    const slots = emptyEchoDraftSlots();
    slots[1] = {
      echoId: "echo:secondary",
      sonataSetId: "sonata:one",
      primaryMainStatId: "echo-main-1-attack-percent",
      substats: [],
    };
    const persisted = loadoutFromDraftSlots(slots);
    expect(persisted.mainEchoId).toBeUndefined();
    expect(persisted.echoes.map((echo) => echo.echoId)).toEqual(["echo:secondary"]);
  });

  it("explains exactly what is missing from an incomplete slot", () => {
    const missingBoth = draftSlotsFromLoadout(loadout);
    missingBoth[0]!.sonataSetId = "";
    missingBoth[0]!.primaryMainStatId = "";
    expect(() => loadoutFromDraftSlots(missingBoth)).toThrow(
      "Slot 1 incomplet : choisissez un Sonata et une main stat.",
    );

    const missingMainStat = draftSlotsFromLoadout(loadout);
    missingMainStat[0]!.primaryMainStatId = "";
    expect(() => loadoutFromDraftSlots(missingMainStat)).toThrow(
      "Slot 1 incomplet : choisissez une main stat.",
    );
  });

  it("rejects malformed substats before storage with a user-facing message", () => {
    const incompleteSubstat = draftSlotsFromLoadout(loadout);
    incompleteSubstat[0]!.substats[0]!.value = "";
    expect(() => loadoutFromDraftSlots(incompleteSubstat)).toThrow(
      "Slot 1 · substat 1 incomplète : choisissez la stat et son roll.",
    );

    const badValue = draftSlotsFromLoadout(loadout);
    badValue[0]!.substats[0]!.value = "NaN";
    expect(() => loadoutFromDraftSlots(badValue)).toThrow(
      "Slot 1 · substat 1 : valeur invalide.",
    );
  });

  it("updates only echoLoadout metadata and preserves finalStats exactly", () => {
    const original = boxWithBuild();
    const beforeStats = structuredClone(original.builds[0]!.finalStats);
    const updated = replaceBuildEchoLoadout(
      original,
      "build:one",
      loadout,
      "2026-08-17T18:31:00.000Z",
    );

    expect(updated.builds[0]!.echoLoadout).toEqual(loadout);
    expect(updated.builds[0]!.finalStats).toEqual(beforeStats);
    expect(updated.builds[0]!.weapon).toEqual(original.builds[0]!.weapon);
    expect(updated.builds[0]!.updatedAt).toBe("2026-08-17T18:31:00.000Z");
  });

  it("can explicitly remove a saved echoLoadout without changing finalStats", () => {
    const withLoadout = replaceBuildEchoLoadout(boxWithBuild(), "build:one", loadout, now);
    const beforeStats = structuredClone(withLoadout.builds[0]!.finalStats);
    const cleared = clearBuildEchoLoadout(
      withLoadout,
      "build:one",
      "2026-08-17T18:32:00.000Z",
    );

    expect(cleared.builds[0]!.echoLoadout).toBeUndefined();
    expect(cleared.builds[0]!.finalStats).toEqual(beforeStats);
  });
});
