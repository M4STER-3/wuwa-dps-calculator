import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { requireResonatorUiAssetId } from "@/game-data/resonator-ui-asset-ids";
import { resonators } from "./catalog";

const isPromoted = (resonator: (typeof resonators)[number]) =>
  resonator.source.kind !== "technical-fixture";

const manifest = JSON.parse(
  readFileSync(path.join(process.cwd(), "public/assets/wuwa/manifest.json"), "utf8"),
) as {
  entities: {
    characters: Record<
      string,
      { assets: Record<string, { path: string }> }
    >;
  };
};

describe("promoted Resonator UI portraits", () => {
  it("binds every promoted Resonator directly to its verified local head icon", () => {
    for (const resonator of resonators.filter(isPromoted)) {
      const assetId = requireResonatorUiAssetId(resonator.id);
      const manifestPath =
        manifest.entities.characters[assetId]?.assets["list-roleheadicon"]?.path;

      expect(manifestPath).toMatch(
        /^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/,
      );
      expect(resonator.portrait).toEqual({
        src: manifestPath,
        alt: `Portrait de ${resonator.name}`,
      });
      expect(
        existsSync(path.join(process.cwd(), "public", manifestPath.slice(1))),
      ).toBe(true);
    }
  });

  it("requires a verified local role portrait for every promoted Character Box hero", () => {
    for (const resonator of resonators.filter(isPromoted)) {
      const assetId = requireResonatorUiAssetId(resonator.id);
      const heroPath =
        manifest.entities.characters[assetId]?.assets["detail-roleportrait"]?.path;

      expect(heroPath).toMatch(
        /^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/,
      );
      expect(
        existsSync(path.join(process.cwd(), "public", heroPath.slice(1))),
      ).toBe(true);
    }
  });

  it("never assigns promoted portraits to technical fixtures", () => {
    for (const resonator of resonators.filter((entry) => !isPromoted(entry))) {
      expect(resonator.portrait).toBeUndefined();
    }
  });
});
