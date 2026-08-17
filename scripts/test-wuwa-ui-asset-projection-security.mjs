import assert from "node:assert/strict";
import {
  projectWuwaUiAssetsV1,
  validateWuwaUiAssetProjectionV1,
} from "./lib/wuwa-ui-asset-projection.mjs";

function asset(hashCharacter, contentType = "image/png") {
  const sha256 = hashCharacter.repeat(64);
  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
  return {
    path: `/assets/wuwa/objects/${sha256}.${extension}`,
    sourceUrl: `https://assets.encore.moe/${sha256}.${extension}`,
    contentType,
    bytes: 1234,
    sha256,
  };
}

function entity(category, id, name, assets) {
  return {
    sourceId: id,
    entityKey: `${category}:${id}`,
    name,
    assets,
  };
}

function manifestFixture() {
  return {
    schemaVersion: 2,
    source: "Encore.moe",
    sourceApi: "https://api-v2.encore.moe/api/en",
    generatedAt: "2026-08-17T00:00:00.000Z",
    entities: {
      characters: {
        "1002": entity("characters", "1002", "Second Character", {
          "list-roleheadicon": asset("b", "image/webp"),
        }),
        "1001": entity("characters", "1001", "Jinhsi", {
          "list-roleheadicon": asset("a"),
          "detail-roleportrait": asset("c", "image/jpeg"),
        }),
      },
      weapons: {
        "2001": entity("weapons", "2001", "Ages of Harvest", {
          "list-icon": asset("d"),
        }),
      },
      echoes: {
        "3001": entity("echoes", "3001", "Crownless", {
          "list-icon": asset("e", "image/webp"),
        }),
      },
    },
  };
}

const projection = projectWuwaUiAssetsV1(manifestFixture());
assert.deepEqual(projection, {
  schemaVersion: 1,
  assetManifestSchemaVersion: 2,
  counts: { characters: 2, weapons: 1, echoes: 1, assets: 5 },
  entries: [
    {
      category: "characters",
      id: "1001",
      assets: [
        {
          role: "detail-roleportrait",
          path: `/assets/wuwa/objects/${"c".repeat(64)}.jpg`,
        },
        {
          role: "list-roleheadicon",
          path: `/assets/wuwa/objects/${"a".repeat(64)}.png`,
        },
      ],
    },
    {
      category: "characters",
      id: "1002",
      assets: [
        {
          role: "list-roleheadicon",
          path: `/assets/wuwa/objects/${"b".repeat(64)}.webp`,
        },
      ],
    },
    {
      category: "weapons",
      id: "2001",
      assets: [{ role: "list-icon", path: `/assets/wuwa/objects/${"d".repeat(64)}.png` }],
    },
    {
      category: "echoes",
      id: "3001",
      assets: [{ role: "list-icon", path: `/assets/wuwa/objects/${"e".repeat(64)}.webp` }],
    },
  ],
});
validateWuwaUiAssetProjectionV1(projection);

const serialized = JSON.stringify(projection);
for (const forbidden of ["sourceUrl", "sourceApi", "Encore.moe", '"name"', '"sha256"', '"contentType"', '"bytes"']) {
  assert.equal(serialized.includes(forbidden), false, `${forbidden} must not be exposed`);
}
assert.equal(serialized.includes("https://"), false, "projection must not expose external URLs");

{
  const source = manifestFixture();
  source.entities.characters["1001"].assets["list-roleheadicon"].path = "https://evil.example/image.png";
  assert.throws(() => projectWuwaUiAssetsV1(source), /same-origin asset path/);
}

{
  const source = manifestFixture();
  source.entities.characters["1001"].assets["list-roleheadicon"].path = "/assets/wuwa/objects/../escape.png";
  assert.throws(() => projectWuwaUiAssetsV1(source), /same-origin asset path/);
}

{
  const source = manifestFixture();
  source.entities.characters["1001"].assets["list-roleheadicon"].sha256 = "f".repeat(64);
  assert.throws(() => projectWuwaUiAssetsV1(source), /sha256 does not match/);
}

{
  const source = manifestFixture();
  source.entities.characters["1001"].assets["list-roleheadicon"].contentType = "image/jpeg";
  assert.throws(() => projectWuwaUiAssetsV1(source), /contentType does not match/);
}

{
  const source = manifestFixture();
  source.schemaVersion = 3;
  assert.throws(() => projectWuwaUiAssetsV1(source), /schemaVersion 2/);
}

{
  const source = manifestFixture();
  source.entities.sonata = {};
  assert.throws(() => projectWuwaUiAssetsV1(source), /exactly characters, weapons, and echoes/);
}

{
  const source = manifestFixture();
  source.entities.characters["1001"].sourceId = "other";
  assert.throws(() => projectWuwaUiAssetsV1(source), /identity mismatch/);
}

{
  const source = manifestFixture();
  source.entities.characters["1001"].assets["javascript:alert(1)"] = asset("f");
  assert.throws(() => projectWuwaUiAssetsV1(source), /safe manifest asset role/);
}

{
  const source = manifestFixture();
  source.entities.characters.constructor = entity("characters", "constructor", "Bad", {
    "list-roleheadicon": asset("f"),
  });
  assert.throws(() => projectWuwaUiAssetsV1(source), /safe source ID/);
}

{
  const poisoned = JSON.parse(JSON.stringify(projection));
  poisoned.entries[0].sourceUrl = "https://evil.example";
  assert.throws(() => validateWuwaUiAssetProjectionV1(poisoned), /unexpected fields/);
}

{
  const duplicate = JSON.parse(JSON.stringify(projection));
  duplicate.entries.splice(1, 0, JSON.parse(JSON.stringify(duplicate.entries[0])));
  duplicate.counts.characters += 1;
  duplicate.counts.assets += duplicate.entries[0].assets.length;
  assert.throws(() => validateWuwaUiAssetProjectionV1(duplicate), /duplicate entity|canonically sorted/);
}

{
  const duplicateRole = JSON.parse(JSON.stringify(projection));
  duplicateRole.entries[0].assets.splice(1, 0, JSON.parse(JSON.stringify(duplicateRole.entries[0].assets[0])));
  duplicateRole.counts.assets += 1;
  assert.throws(() => validateWuwaUiAssetProjectionV1(duplicateRole), /duplicate role|canonically sorted/);
}

{
  const unsorted = JSON.parse(JSON.stringify(projection));
  [unsorted.entries[0], unsorted.entries[1]] = [unsorted.entries[1], unsorted.entries[0]];
  assert.throws(() => validateWuwaUiAssetProjectionV1(unsorted), /canonically sorted/);
}

{
  const countMismatch = JSON.parse(JSON.stringify(projection));
  countMismatch.counts.assets += 1;
  assert.throws(() => validateWuwaUiAssetProjectionV1(countMismatch), /count mismatch/);
}

console.log("WUWA UI asset projection security tests passed.");
