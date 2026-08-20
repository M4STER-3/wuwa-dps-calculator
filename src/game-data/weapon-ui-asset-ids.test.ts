import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { weapons } from "../data/catalog";
import {
  getWeaponUiAssetId,
  getWeaponUiIconPath,
  promotedWeaponUiAssets,
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

const EXPECTED_IDS = {
  "everbright-polestar": "21020076",
  "thunderflare-dominion": "21010046",
  "unflickering-valor": "21020036",
  "lustrous-razor": "21010015",
  "whispers-of-sirens": "21050056",
  "the-last-dance": "21030016",
  "defiers-thorn": "21020056",
  "blazing-brilliance": "21020016",
  kumokiri: "21010056",
  "woodland-aria": "21030026",
  variation: "21050024",
  "precise-phrolova-signature": "21050066",
  "precise-denia-signature": "21050076",
  "precise-lynae-signature": "21030046",
  "precise-mornye-signature": "21010066",
  "precise-qiuyuan-signature": "21020066",
  "precise-jinhsi-signature": "21010026",
  "precise-galbrena-signature": "21030036",
  "precise-iuno-signature": "21040046",
  "precise-shorekeeper-signature": "21050036",
  "precise-hiyuki-signature": "21020086",
} as const;

describe("promoted weapon UI assets", () => {
  it("keeps the reviewed weapon crosswalk stable", () => {
    expect(
      Object.fromEntries(
        Object.entries(promotedWeaponUiAssets).map(([id, asset]) => [id, asset.assetId]),
      ),
    ).toEqual(EXPECTED_IDS);
  });

  it("uses unique numeric Wuwa IDs", () => {
    const values = Object.values(EXPECTED_IDS);
    expect(values.every((value) => /^\d+$/.test(value))).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });

  it("covers every real weapon promoted into the functional catalogue", () => {
    const promoted = weapons.filter(
      (weapon) => weapon.source.kind !== "technical-fixture",
    );

    for (const weapon of promoted) {
      expect(getWeaponUiAssetId(weapon.id)).toMatch(/^\d+$/);
    }
  });

  it("maps every reviewed ID to a real local list-icon", () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "public/assets/wuwa/manifest.json"), "utf8"),
    ) as AssetManifest;

    for (const [weaponId, asset] of Object.entries(promotedWeaponUiAssets)) {
      const manifestPath =
        manifest.entities?.weapons?.[asset.assetId]?.assets?.["list-icon"]?.path;
      expect(manifestPath, `${weaponId} should expose list-icon`).toMatch(
        /^\/assets\/wuwa\/objects\/[0-9a-f]{64}\.(png|jpg|webp)$/,
      );
      expect(
        existsSync(
          join(process.cwd(), "public", manifestPath!.replace(/^\/+/, "")),
        ),
        `${weaponId} icon should exist in public asset objects`,
      ).toBe(true);

      const directPath = getWeaponUiIconPath(weaponId);
      if (directPath) expect(directPath).toBe(manifestPath);
    }
  });
});
