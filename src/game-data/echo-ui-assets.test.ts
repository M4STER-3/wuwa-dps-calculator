import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  getEchoUiAssetSourceId,
  WUWA_ECHO_DISPLAY_ROLES,
} from "./echo-ui-assets";

describe("Echo UI asset identity", () => {
  it("accepts only canonical numeric Echo ids", () => {
    expect(getEchoUiAssetSourceId("echo:340000010")).toBe("340000010");
    expect(getEchoUiAssetSourceId("Sigillum")).toBeUndefined();
    expect(getEchoUiAssetSourceId("echo:../1")).toBeUndefined();
    expect(getEchoUiAssetSourceId("echo:__proto__")).toBeUndefined();
    expect(getEchoUiAssetSourceId("echo:1\u0000")).toBeUndefined();
  });

  it("maps every promoted base Echo to a verified local icon", () => {
    const root = process.cwd();
    const database = JSON.parse(
      readFileSync(path.join(root, "public/data/wuwa/game-database-v1.json"), "utf8"),
    ) as { echoes: Array<{ id: string }> };
    const manifest = JSON.parse(
      readFileSync(path.join(root, "public/assets/wuwa/manifest.json"), "utf8"),
    ) as {
      entities: {
        echoes: Record<
          string,
          { assets: Record<string, { path: string }> }
        >;
      };
    };

    expect(database.echoes.length).toBeGreaterThan(0);

    for (const echo of database.echoes) {
      const sourceId = getEchoUiAssetSourceId(echo.id);
      expect(sourceId, `canonical asset source for ${echo.id}`).toBeTruthy();
      const entity = manifest.entities.echoes[sourceId!];
      expect(entity, `manifest entity for ${echo.id} -> ${sourceId}`).toBeTruthy();

      const asset = WUWA_ECHO_DISPLAY_ROLES
        .map((role) => entity?.assets[role])
        .find(Boolean);
      expect(asset, `detail/list icon for ${echo.id}`).toBeTruthy();
      expect(asset!.path).toMatch(
        /^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/,
      );
      expect(
        existsSync(path.join(root, "public", asset!.path.slice(1))),
        `local object for ${echo.id}`,
      ).toBe(true);
    }
  });
});
