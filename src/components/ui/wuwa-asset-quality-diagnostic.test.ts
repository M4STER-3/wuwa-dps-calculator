import { readFile } from "node:fs/promises";
import path from "node:path";

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

function uint24le(buffer: Buffer, offset: number) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebpDimensions(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.subarray(offset, offset + 4).toString("ascii");
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (chunk === "VP8X" && data + 10 <= buffer.length) {
      return {
        width: 1 + uint24le(buffer, data + 4),
        height: 1 + uint24le(buffer, data + 7),
      };
    }

    if (chunk === "VP8L" && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const b1 = buffer[data + 1];
      const b2 = buffer[data + 2];
      const b3 = buffer[data + 3];
      const b4 = buffer[data + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
      };
    }

    if (
      chunk === "VP8 " &&
      data + 10 <= buffer.length &&
      buffer[data + 3] === 0x9d &&
      buffer[data + 4] === 0x01 &&
      buffer[data + 5] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      };
    }

    offset = data + size + (size % 2);
  }

  return null;
}

async function inspect(category: string, id: string) {
  const raw = await readFile("public/assets/wuwa/manifest.json", "utf8");
  const manifest = JSON.parse(raw) as Manifest;
  const entities = dictionary(manifest.entities);
  const categoryEntries = dictionary(entities?.[category]);
  const entity = categoryEntries?.[id] as ManifestEntity | undefined;
  const assets = dictionary(entity?.assets);

  expect(assets, `${category}:${id} must exist in the promoted manifest`).not.toBeNull();

  const rows = await Promise.all(
    Object.entries(assets ?? {}).map(async ([role, rawAsset]) => {
      const asset = rawAsset as ManifestAsset;
      const assetPath = typeof asset.path === "string" ? asset.path : "unknown";
      let dimensions: { width: number; height: number } | null = null;
      if (assetPath.endsWith(".webp") && assetPath.startsWith("/assets/wuwa/objects/")) {
        const buffer = await readFile(path.join("public", assetPath.slice(1)));
        dimensions = readWebpDimensions(buffer);
      }
      return {
        role,
        bytes: typeof asset.bytes === "number" ? asset.bytes : -1,
        contentType: typeof asset.contentType === "string" ? asset.contentType : "unknown",
        dimensions,
        path: assetPath,
      };
    }),
  );

  rows.sort((a, b) => b.bytes - a.bytes || a.role.localeCompare(b.role));
  console.log(`ASSET_QUALITY ${category}:${id} ${JSON.stringify(rows)}`);
  expect(rows.length).toBeGreaterThan(0);
}

describe("representative promoted asset quality", () => {
  test("lists available roles and intrinsic dimensions for the visual checkpoint", async () => {
    await inspect("characters", "1102");
    await inspect("weapons", "21010011");
    await inspect("weapons", "21010012");
    await inspect("weapons", "21010013");
  });
});
