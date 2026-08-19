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

describe("pinned community Echo presets", () => {
  it("only targets supported non-excluded Resonators", () => {
    const supported = new Set([...roster10R1Ids, "verina"]);
    for (const resonatorId of Object.keys(generatedCommunityEchoPresets10R1)) {
      expect(supported.has(resonatorId), resonatorId).toBe(true);
      expect(resonatorId).not.toBe("camellya");
    }
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

  it("infers a Main Echo only when a source-omitted 43311 has one unambiguous 4-cost", () => {
    for (const [resonatorId, preset] of Object.entries(
      generatedCommunityEchoPresets10R1,
    )) {
      if (preset.mainEchoSelection !== "single-four-cost-default") continue;
      const fourCostIds = preset.echoLoadout.echoes
        .filter((equipped) => {
          const catalogEcho = echoCatalog.echoes.find(
            (echo) => echo.id === equipped.echoId,
          );
          return catalogEcho?.cost === 4;
        })
        .map((equipped) => equipped.echoId);
      expect(fourCostIds, resonatorId).toHaveLength(1);
      expect(preset.echoLoadout.mainEchoId, resonatorId).toBe(fourCostIds[0]);
    }

    expect(
      generatedCommunityEchoPresets10R1.changli.mainEchoSelection,
    ).toBe("single-four-cost-default");
    expect(
      generatedCommunityEchoPresets10R1.changli.echoLoadout.mainEchoId,
    ).toBe(
      generatedCommunityEchoPresets10R1.changli.echoLoadout.echoes[0].echoId,
    );
  });

  it("keeps curated presets explicit instead of presenting them as verbatim fixtures", () => {
    const curatedIds = [
      "augusta",
      "calcharo",
      "cantarella",
      "cartethyia",
      "chisa",
      "ciaccona",
      "verina",
    ] as const;
    for (const resonatorId of curatedIds) {
      const preset = generatedCommunityEchoPresets10R1[resonatorId];
      expect(preset.promotionStatus, resonatorId).toBe("curated-balanced");
      expect("promotionNote" in preset && preset.promotionNote.length > 0).toBe(true);
    }
  });

  it("preserves verbatim verified fixtures separately from curated presets", () => {
    for (const resonatorId of ["aemeath", "brant", "carlotta", "changli"] as const) {
      expect(generatedCommunityEchoPresets10R1[resonatorId].promotionStatus).toBe(
        "verified",
      );
    }
  });
});
