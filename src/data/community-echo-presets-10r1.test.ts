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

describe("10R1 pinned community Echo presets", () => {
  it("only targets promoted non-excluded Resonators", () => {
    const promoted = new Set(roster10R1Ids);
    for (const resonatorId of Object.keys(generatedCommunityEchoPresets10R1)) {
      expect(promoted.has(resonatorId)).toBe(true);
      expect(resonatorId).not.toBe("camellya");
    }
  });

  it("resolves every verified loadout through the authoritative Echo resolver", () => {
    for (const [resonatorId, preset] of Object.entries(
      generatedCommunityEchoPresets10R1,
    )) {
      if (preset.promotionStatus !== "verified") continue;
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

  it("keeps blocked source candidates explicit and unpromoted", () => {
    for (const preset of Object.values(generatedCommunityEchoPresets10R1)) {
      if (preset.promotionStatus === "verified") continue;
      expect(preset.promotionStatus).toBe("blocked-invalid-roll");
      expect("promotionNote" in preset && preset.promotionNote.length > 0).toBe(true);
    }
    expect(generatedCommunityEchoPresets10R1.augusta.promotionStatus).toBe(
      "blocked-invalid-roll",
    );
    expect(generatedCommunityEchoPresets10R1.cantarella.promotionStatus).toBe(
      "blocked-invalid-roll",
    );
    expect(generatedCommunityEchoPresets10R1.ciaccona.promotionStatus).toBe(
      "blocked-invalid-roll",
    );
  });

  it("keeps unresolved source gaps out instead of guessing", () => {
    expect(generatedCommunityEchoPresets10R1).not.toHaveProperty("calcharo");
    expect(generatedCommunityEchoPresets10R1).not.toHaveProperty("cartethyia");
  });
});
