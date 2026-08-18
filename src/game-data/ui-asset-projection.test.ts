import { describe, expect, it } from "vitest";
import {
  findWuwaUiAssetEntryV1,
  findWuwaUiAssetPathV1,
  isWuwaUiAssetProjectionV1,
  type WuwaUiAssetProjectionV1,
} from "./ui-asset-projection";

const projection: WuwaUiAssetProjectionV1 = {
  schemaVersion: 1,
  assetManifestSchemaVersion: 2,
  counts: { characters: 1, weapons: 1, echoes: 1, assets: 4 },
  entries: [
    {
      category: "characters",
      id: "1001",
      assets: [
        { role: "detail-roleportrait", path: `/assets/wuwa/objects/${"a".repeat(64)}.webp` },
        { role: "list-roleheadicon", path: `/assets/wuwa/objects/${"b".repeat(64)}.png` },
      ],
    },
    {
      category: "weapons",
      id: "2001",
      assets: [{ role: "list-icon", path: `/assets/wuwa/objects/${"c".repeat(64)}.png` }],
    },
    {
      category: "echoes",
      id: "3001",
      assets: [{ role: "list-icon", path: `/assets/wuwa/objects/${"d".repeat(64)}.jpg` }],
    },
  ],
};

describe("WUWA UI asset projection", () => {
  it("accepts same-origin assets and resolves exact stable IDs and preferred roles", () => {
    expect(isWuwaUiAssetProjectionV1(projection)).toBe(true);
    expect(findWuwaUiAssetEntryV1(projection, "characters", "1001")?.id).toBe("1001");
    expect(
      findWuwaUiAssetPathV1(projection, "characters", "1001", [
        "missing-role",
        "detail-roleportrait",
      ]),
    ).toBe(`/assets/wuwa/objects/${"a".repeat(64)}.webp`);
    expect(findWuwaUiAssetPathV1(projection, "characters", "Jinhsi", ["detail-roleportrait"])).toBeUndefined();
  });

  it("rejects external, traversal, extra-field, duplicate-role, and count-poisoned payloads", () => {
    const external = structuredClone(projection) as unknown as Record<string, unknown>;
    const externalEntries = external.entries as Array<Record<string, unknown>>;
    const externalAssets = externalEntries[0]!.assets as Array<Record<string, unknown>>;
    externalAssets[0]!.path = "https://evil.example/image.webp";
    expect(isWuwaUiAssetProjectionV1(external)).toBe(false);

    const traversal = structuredClone(projection) as unknown as Record<string, unknown>;
    const traversalEntries = traversal.entries as Array<Record<string, unknown>>;
    const traversalAssets = traversalEntries[0]!.assets as Array<Record<string, unknown>>;
    traversalAssets[0]!.path = "/assets/wuwa/objects/../image.webp";
    expect(isWuwaUiAssetProjectionV1(traversal)).toBe(false);

    const extraField = structuredClone(projection) as unknown as Record<string, unknown>;
    const extraEntries = extraField.entries as Array<Record<string, unknown>>;
    extraEntries[0]!.name = "must not cross the projection boundary";
    expect(isWuwaUiAssetProjectionV1(extraField)).toBe(false);

    const duplicateRole = structuredClone(projection) as unknown as Record<string, unknown>;
    const duplicateEntries = duplicateRole.entries as Array<Record<string, unknown>>;
    const duplicateAssets = duplicateEntries[0]!.assets as Array<Record<string, unknown>>;
    duplicateAssets.push(structuredClone(duplicateAssets[0]!));
    const duplicateCounts = duplicateRole.counts as Record<string, number>;
    duplicateCounts.assets += 1;
    expect(isWuwaUiAssetProjectionV1(duplicateRole)).toBe(false);

    const poisonedCount = structuredClone(projection) as unknown as Record<string, unknown>;
    const counts = poisonedCount.counts as Record<string, number>;
    counts.assets += 1;
    expect(isWuwaUiAssetProjectionV1(poisonedCount)).toBe(false);
  });
});
