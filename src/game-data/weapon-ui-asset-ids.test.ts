import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { weapons } from "../data/catalog";
import {
  getWeaponUiAssetId,
  promotedWeaponUiAssets,
  requireWeaponUiIconPath,
} from "./weapon-ui-asset-ids";

type AssetManifest = {
  entities?: {
    weapons?: Record<
      string,
      {
        assets?: Record<string, { path?: string }>;
      }
    >;
  };
};

describe("promoted weapon UI assets", () => {
  it("keeps the verified weapon crosswalk stable", () => {
    expect(
      Object.fromEntries(
        Object.entries(promotedWeaponUiAssets).map(([id, asset]) => [id, asset.assetId]),
      ),
    ).toEqual({
      "everbright-polestar": "21020076",
      kumokiri: "21010056",
      variation: "21050024",
    });
  });

  it("covers every real weapon promoted into the functional catalogue", () => {
    const promoted = weapons.filter(
      (weapon) => weapon.source.kind !== "technical-fixture",
    );

    for (const weapon of promoted) {
      expect(getWeaponUiAssetId(weapon.id)).toMatch(/^\d+$/);
      expect(() => requireWeaponUiIconPath(weapon.id)).not.toThrow();
    }
  });

  it("matches the audited list-icon path in the local manifest and object store", () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "public/assets/wuwa/manifest.json"), "utf8"),
    ) as AssetManifest;

    for (const [weaponId, asset] of Object.entries(promotedWeaponUiAssets)) {
      const manifestPath =
        manifest.entities?.weapons?.[asset.assetId]?.assets?.["list-icon"]?.path;
      expect(manifestPath).toBe(asset.iconPath);
      expect(
        existsSync(
          join(process.cwd(), "public", asset.iconPath.replace(/^\/+/, "")),
        ),
        `${weaponId} icon should exist in public asset objects`,
      ).toBe(true);
    }
  });
});
