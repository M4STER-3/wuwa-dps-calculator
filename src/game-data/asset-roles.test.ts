import { describe, expect, it } from "vitest";
import { createGameAssetRegistry } from "./asset-registry";
import {
  getGameAssetSemanticRoleDefinition,
  resolveGameAssetByRole,
} from "./asset-roles";

const SHA_CHARACTER = "1".repeat(64);
const SHA_WEAPON = "2".repeat(64);
const SHA_ECHO = "3".repeat(64);
const SHA_DETAIL = "4".repeat(64);

function asset(sha256: string) {
  return {
    path: `/assets/wuwa/objects/${sha256}.webp`,
    sourceUrl: `https://cdn.encore.moe/assets/${sha256}.webp`,
    contentType: "image/webp",
    bytes: 10_000,
    sha256,
  };
}

function registry() {
  return createGameAssetRegistry({
    schemaVersion: 2,
    source: "Encore.moe",
    sourceApi: "https://api-v2.encore.moe/api/en",
    gameVersion: "Release",
    generatedAt: "2026-08-17T10:00:00.000Z",
    categories: ["characters", "weapons", "echoes"],
    storage: {
      strategy: "sha256-content-addressed",
      root: "/assets/wuwa/objects",
    },
    security: {},
    entities: {
      characters: {
        "1305": {
          sourceId: "1305",
          entityKey: "characters:1305",
          name: "Ignored source display name",
          assets: {
            "list-roleheadicon": asset(SHA_CHARACTER),
            "detail-roleportrait": asset(SHA_DETAIL),
          },
        },
      },
      weapons: {
        "21010011": {
          sourceId: "21010011",
          entityKey: "weapons:21010011",
          name: "Ignored source display name",
          assets: {
            "list-icon": asset(SHA_WEAPON),
          },
        },
      },
      echoes: {
        "6000042": {
          sourceId: "6000042",
          entityKey: "echoes:6000042",
          name: "Ignored source display name",
          assets: {
            "list-icon": asset(SHA_ECHO),
            "detail-icon": asset(SHA_DETAIL),
          },
        },
      },
    },
  });
}

describe("reviewed game asset semantic roles", () => {
  it("resolves only the universal character list head icon", () => {
    const value = registry();
    const resolved = resolveGameAssetByRole(value, "character-head-icon", "1305");

    expect(resolved?.assetKey).toBe("list-roleheadicon");
    expect(resolved?.sha256).toBe(SHA_CHARACTER);
    expect(resolved?.assetKey).not.toBe("detail-roleportrait");
  });

  it("resolves the reviewed universal list icon for weapons and Echoes", () => {
    const value = registry();

    expect(resolveGameAssetByRole(value, "weapon-icon", "21010011")?.sha256).toBe(
      SHA_WEAPON,
    );
    expect(resolveGameAssetByRole(value, "echo-icon", "6000042")?.sha256).toBe(
      SHA_ECHO,
    );
  });

  it("does not fall back to another category or a detail image", () => {
    const value = registry();

    expect(resolveGameAssetByRole(value, "character-head-icon", "21010011")).toBeUndefined();
    expect(resolveGameAssetByRole(value, "weapon-icon", "1305")).toBeUndefined();
    expect(resolveGameAssetByRole(value, "echo-icon", "1305")).toBeUndefined();
  });

  it("keeps the role definitions exact and auditable", () => {
    expect(getGameAssetSemanticRoleDefinition("character-head-icon")).toEqual({
      category: "characters",
      assetKeys: ["list-roleheadicon"],
    });
    expect(getGameAssetSemanticRoleDefinition("weapon-icon")).toEqual({
      category: "weapons",
      assetKeys: ["list-icon"],
    });
    expect(getGameAssetSemanticRoleDefinition("echo-icon")).toEqual({
      category: "echoes",
      assetKeys: ["list-icon"],
    });
  });
});
