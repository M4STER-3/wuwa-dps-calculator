import { describe, expect, it } from "vitest";
import {
  createGameAssetRegistry,
  GameAssetManifestError,
} from "./asset-registry";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function asset(
  sha256: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    path: `/assets/wuwa/objects/${sha256}.webp`,
    sourceUrl: `https://cdn.encore.moe/assets/${sha256}.webp`,
    contentType: "image/webp",
    bytes: 12_345,
    sha256,
    ...overrides,
  };
}

function manifest(): Record<string, unknown> {
  return {
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
    security: {
      allowedFormats: ["image/png", "image/jpeg", "image/webp"],
      maxImageBytes: 8 * 1024 * 1024,
    },
    entities: {
      characters: {
        "1305": {
          sourceId: "1305",
          entityKey: "characters:1305",
          name: "Source display name is deliberately not exposed",
          assets: {
            "detail-roleheadicon": asset(SHA_A),
            "detail-roleportrait": asset(SHA_B),
          },
        },
      },
      weapons: {
        "21010011": {
          sourceId: "21010011",
          entityKey: "weapons:21010011",
          name: "Fixture Weapon",
          assets: {
            "detail-icon": asset(SHA_A),
          },
        },
      },
      echoes: {},
    },
  };
}

function cloneManifest(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(manifest())) as Record<string, unknown>;
}

function entityAsset(
  value: Record<string, unknown>,
  category: "characters" | "weapons" | "echoes",
  sourceId: string,
  assetKey: string,
): Record<string, unknown> {
  const entities = value.entities as Record<string, Record<string, Record<string, unknown>>>;
  const entity = entities[category][sourceId];
  const assets = entity.assets as Record<string, Record<string, unknown>>;
  return assets[assetKey];
}

describe("GameAssetRegistry", () => {
  it("joins assets by category + Encore source id and exposes local content-addressed metadata only", () => {
    const registry = createGameAssetRegistry(manifest());

    expect(registry.schemaVersion).toBe(2);
    expect(registry.gameVersion).toBe("Release");
    expect(registry.hasEntity("characters", "1305")).toBe(true);
    expect(registry.getEntity("characters", "1305")?.entityKey).toBe("characters:1305");

    const portrait = registry.get("characters", "1305", "detail-roleportrait");
    expect(portrait).toEqual({
      assetKey: "detail-roleportrait",
      path: `/assets/wuwa/objects/${SHA_B}.webp`,
      contentType: "image/webp",
      bytes: 12_345,
      sha256: SHA_B,
    });
    expect(portrait).not.toHaveProperty("sourceUrl");
    expect(registry.getEntity("characters", "1305")).not.toHaveProperty("name");
  });

  it("uses only an explicit caller-provided role preference order", () => {
    const registry = createGameAssetRegistry(manifest());

    expect(
      registry.firstMatching("characters", "1305", [
        "missing-role",
        "detail-roleportrait",
        "detail-roleheadicon",
      ])?.assetKey,
    ).toBe("detail-roleportrait");
    expect(registry.firstMatching("characters", "1305", ["missing-role"])).toBeUndefined();
  });

  it("allows several entities to reuse the same content-addressed object", () => {
    const registry = createGameAssetRegistry(manifest());

    expect(registry.get("characters", "1305", "detail-roleheadicon")?.path).toBe(
      registry.get("weapons", "21010011", "detail-icon")?.path,
    );
  });

  it("rejects an external source URL even though source URLs are not exposed at runtime", () => {
    const value = cloneManifest();
    entityAsset(value, "characters", "1305", "detail-roleheadicon").sourceUrl =
      "https://evil.example/advertisement.webp";

    expect(() => createGameAssetRegistry(value)).toThrow(GameAssetManifestError);
    expect(() => createGameAssetRegistry(value)).toThrow(/outside the reviewed Encore image boundary/i);
  });

  it("rejects a local object path that does not match the recorded hash", () => {
    const value = cloneManifest();
    entityAsset(value, "characters", "1305", "detail-roleheadicon").path =
      `/assets/wuwa/objects/${SHA_B}.webp`;

    expect(() => createGameAssetRegistry(value)).toThrow(/content-addressed path/i);
  });

  it("rejects a path extension that does not match the MIME type", () => {
    const value = cloneManifest();
    entityAsset(value, "characters", "1305", "detail-roleheadicon").path =
      `/assets/wuwa/objects/${SHA_A}.png`;

    expect(() => createGameAssetRegistry(value)).toThrow(/content-addressed path/i);
  });

  it("rejects an entityKey/sourceId mismatch", () => {
    const value = cloneManifest();
    const entities = value.entities as Record<string, Record<string, Record<string, unknown>>>;
    entities.characters["1305"].entityKey = "characters:9999";

    expect(() => createGameAssetRegistry(value)).toThrow(/entityKey/i);
  });

  it("rejects unexpected manifest categories", () => {
    const value = cloneManifest();
    const entities = value.entities as Record<string, unknown>;
    entities.sonata = {};

    expect(() => createGameAssetRegistry(value)).toThrow(/unexpected key/i);
  });

  it("rejects dangerous object keys instead of indexing them", () => {
    const value = cloneManifest();
    const entities = value.entities as Record<string, unknown>;
    entities.characters = JSON.parse(
      `{"__proto__":{"sourceId":"__proto__","entityKey":"characters:__proto__","assets":{}}}`,
    ) as Record<string, unknown>;

    expect(() => createGameAssetRegistry(value)).toThrow(/forbidden object key/i);
  });

  it("rejects malformed hashes, unsupported MIME types and oversized asset records", () => {
    const invalidHash = cloneManifest();
    entityAsset(invalidHash, "characters", "1305", "detail-roleheadicon").sha256 = "not-a-hash";
    expect(() => createGameAssetRegistry(invalidHash)).toThrow(/SHA-256/i);

    const invalidMime = cloneManifest();
    entityAsset(invalidMime, "characters", "1305", "detail-roleheadicon").contentType =
      "image/svg+xml";
    expect(() => createGameAssetRegistry(invalidMime)).toThrow(/MIME/i);

    const oversized = cloneManifest();
    entityAsset(oversized, "characters", "1305", "detail-roleheadicon").bytes =
      8 * 1024 * 1024 + 1;
    expect(() => createGameAssetRegistry(oversized)).toThrow(/no greater than/i);
  });
});
