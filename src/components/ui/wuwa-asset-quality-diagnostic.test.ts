import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

type ManifestAsset = {
  path?: unknown;
  bytes?: unknown;
  contentType?: unknown;
};

type ManifestEntity = {
  assets?: unknown;
};

type Manifest = {
  entities?: unknown;
};

function dictionary(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function inspect(category: string, id: string) {
  const raw = await readFile("public/assets/wuwa/manifest.json", "utf8");
  const manifest = JSON.parse(raw) as Manifest;
  const entities = dictionary(manifest.entities);
  const categoryEntries = dictionary(entities?.[category]);
  const entity = categoryEntries?.[id] as ManifestEntity | undefined;
  const assets = dictionary(entity?.assets);

  expect(assets, `${category}:${id} must exist in the promoted manifest`).not.toBeNull();

  const rows = Object.entries(assets ?? {})
    .map(([role, rawAsset]) => {
      const asset = rawAsset as ManifestAsset;
      return {
        role,
        bytes: typeof asset.bytes === "number" ? asset.bytes : -1,
        contentType: typeof asset.contentType === "string" ? asset.contentType : "unknown",
        path: typeof asset.path === "string" ? asset.path : "unknown",
      };
    })
    .sort((a, b) => b.bytes - a.bytes || a.role.localeCompare(b.role));

  console.log(`ASSET_QUALITY ${category}:${id} ${JSON.stringify(rows)}`);
  expect(rows.length).toBeGreaterThan(0);
}

describe("representative promoted asset quality", () => {
  test("lists available roles for the visual checkpoint", async () => {
    await inspect("characters", "1102");
    await inspect("weapons", "21010011");
    await inspect("weapons", "21010012");
    await inspect("weapons", "21010013");
  });
});
