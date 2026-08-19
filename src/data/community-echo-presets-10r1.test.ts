import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";
import { resolveEchoLoadoutV1 } from "@/game-data/echo-loadout";
import { roster10R1Ids } from "./roster-10r1";

const echoCatalog = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public/data/wuwa/echo-catalog-v1.json"),
    "utf8",
  ),
) as {
  echoes: readonly {
    id: string;
    cost: 1 | 3 | 4;
    sonataSetIds: readonly string[];
  }[];
  sonataSets: readonly { id: string }[];
};

const promotedStatuses = new Set(["verified", "curated-balanced"]);

describe("10R1 pinned community Echo presets", () => {
  it("covers every promoted non-excluded Resonator exactly once", () => {
    const expected = [...roster10R1Ids].sort();
    const generated = Object.keys(generatedCommunityEchoPresets10R1).sort();
    expect(generated).toEqual(expected);
    expect(generated).toHaveLength(10);
    expect(generated).not.toContain("camellya");
  });

  it("resolves every promoted loadout through the authoritative Echo resolver", () => {
    for (const [resonatorId, preset] of Object.entries(
      generatedCommunityEchoPresets10R1,
    )) {
      if (!promotedStatuses.has(preset.promotionStatus)) continue;
      expect(preset.echoLoadout.echoes).toHaveLength(5);
      const resolved = resolveEchoLoadoutV1(echoCatalog, preset.echoLoadout);
      expect(resolved.totalCost, resonatorId).toBeLessThanOrEqual(12);
      expect(resolved.echoes, resonatorId).toHaveLength(5);
      if (
        "mainEchoId" in preset.echoLoadout &&
        preset.echoLoadout.mainEchoId !== undefined
      ) {
        const mainEchoId = preset.echoLoadout.mainEchoId;
        expect(
          resolved.echoes.some((echo) => echo.echoId === mainEchoId),
          resonatorId,
        ).toBe(true);
      }
    }
  });

  it("keeps curated presets explicit instead of presenting them as verbatim fixtures", () => {
    const curatedIds = [
      "augusta",
      "calcharo",
      "cantarella",
      "cartethyia",
      "chisa",
      "ciaccona",
    ] as const;
    for (const resonatorId of curatedIds) {
      const preset = generatedCommunityEchoPresets10R1[resonatorId];
      expect(preset.promotionStatus, resonatorId).toBe("curated-balanced");
      expect("promotionNote" in preset && preset.promotionNote.length > 0).toBe(true);
    }
  });

  it("preserves verbatim verified fixtures separately from curated presets", () => {
    for (const resonatorId of [
      "aemeath",
      "brant",
      "carlotta",
      "changli",
    ] as const) {
      expect(generatedCommunityEchoPresets10R1[resonatorId].promotionStatus).toBe(
        "verified",
      );
    }
  });
});
