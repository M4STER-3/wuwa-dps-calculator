const CATEGORIES = Object.freeze(["characters", "weapons", "echoes"]);
const CATEGORY_ORDER = new Map(CATEGORIES.map((category, index) => [category, index]));
const DANGEROUS_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const SAFE_ROLE = /^[a-z0-9._-]+$/;
const LOCAL_ASSET_PATH = /^\/assets\/wuwa\/objects\/([a-f0-9]{64})\.(png|jpg|webp)$/;
const CONTENT_TYPE_EXTENSION = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ownKeys(value) {
  return Object.keys(value).sort();
}

function assertExactKeys(value, expected, label) {
  const actual = ownKeys(value);
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} contains unexpected fields`);
  }
}

function assertSourceId(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 128 ||
    CONTROL_CHARACTERS.test(value) ||
    DANGEROUS_OBJECT_KEYS.has(value)
  ) {
    throw new Error(`${label} must be a bounded safe source ID`);
  }
  return value;
}

function assertRole(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1024 ||
    !SAFE_ROLE.test(value) ||
    DANGEROUS_OBJECT_KEYS.has(value)
  ) {
    throw new Error(`${label} must be a safe manifest asset role`);
  }
  return value;
}

function assertLocalAssetPath(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a local asset path`);
  const match = LOCAL_ASSET_PATH.exec(value);
  if (!match) throw new Error(`${label} must be a content-addressed same-origin asset path`);
  return { path: value, sha256: match[1], extension: match[2] };
}

function assertManifestAsset(asset, label) {
  if (!isRecord(asset)) throw new Error(`${label} must be an object`);
  const local = assertLocalAssetPath(asset.path, `${label}.path`);
  if (typeof asset.sha256 !== "string" || asset.sha256 !== local.sha256) {
    throw new Error(`${label}.sha256 does not match its local path`);
  }
  const extension = CONTENT_TYPE_EXTENSION[asset.contentType];
  if (!extension || extension !== local.extension) {
    throw new Error(`${label}.contentType does not match its local path`);
  }
  return local.path;
}

function compareEntries(left, right) {
  const categoryDelta = CATEGORY_ORDER.get(left.category) - CATEGORY_ORDER.get(right.category);
  if (categoryDelta !== 0) return categoryDelta;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function compareAssets(left, right) {
  return left.role < right.role ? -1 : left.role > right.role ? 1 : 0;
}

export function projectWuwaUiAssetsV1(manifest) {
  if (!isRecord(manifest) || manifest.schemaVersion !== 2) {
    throw new Error("Asset manifest must use schemaVersion 2");
  }
  if (!isRecord(manifest.entities)) throw new Error("Asset manifest entities are missing");

  const entityCategories = ownKeys(manifest.entities);
  const expectedCategories = [...CATEGORIES].sort();
  if (
    entityCategories.length !== expectedCategories.length ||
    entityCategories.some((category, index) => category !== expectedCategories[index])
  ) {
    throw new Error("Asset manifest must contain exactly characters, weapons, and echoes");
  }

  const entries = [];
  const counts = { characters: 0, weapons: 0, echoes: 0, assets: 0 };

  for (const category of CATEGORIES) {
    const categoryEntities = manifest.entities[category];
    if (!isRecord(categoryEntities)) throw new Error(`Asset manifest ${category} must be an object`);

    for (const [sourceIdKey, entity] of Object.entries(categoryEntities)) {
      const id = assertSourceId(sourceIdKey, `${category} source ID`);
      if (!isRecord(entity)) throw new Error(`Asset manifest ${category}:${id} must be an object`);
      if (entity.sourceId !== id || entity.entityKey !== `${category}:${id}`) {
        throw new Error(`Asset manifest ${category}:${id} identity mismatch`);
      }
      if (!isRecord(entity.assets)) throw new Error(`Asset manifest ${category}:${id} assets are missing`);

      const assets = [];
      for (const [roleKey, asset] of Object.entries(entity.assets)) {
        const role = assertRole(roleKey, `${category}:${id} role`);
        const path = assertManifestAsset(asset, `${category}:${id}:${role}`);
        assets.push(Object.freeze({ role, path }));
      }
      if (assets.length === 0) throw new Error(`Asset manifest ${category}:${id} has no assets`);
      assets.sort(compareAssets);

      entries.push(Object.freeze({ category, id, assets: Object.freeze(assets) }));
      counts[category] += 1;
      counts.assets += assets.length;
    }
  }

  entries.sort(compareEntries);
  const projection = Object.freeze({
    schemaVersion: 1,
    assetManifestSchemaVersion: 2,
    counts: Object.freeze(counts),
    entries: Object.freeze(entries),
  });
  validateWuwaUiAssetProjectionV1(projection);
  return projection;
}

export function validateWuwaUiAssetProjectionV1(value) {
  if (!isRecord(value)) throw new Error("UI asset projection must be an object");
  assertExactKeys(
    value,
    ["schemaVersion", "assetManifestSchemaVersion", "counts", "entries"],
    "UI asset projection",
  );
  if (value.schemaVersion !== 1 || value.assetManifestSchemaVersion !== 2) {
    throw new Error("UI asset projection has an unsupported schema version");
  }
  if (!isRecord(value.counts)) throw new Error("UI asset projection counts are missing");
  assertExactKeys(value.counts, ["characters", "weapons", "echoes", "assets"], "UI asset counts");
  for (const key of ["characters", "weapons", "echoes", "assets"]) {
    if (!Number.isInteger(value.counts[key]) || value.counts[key] < 0) {
      throw new Error(`UI asset count ${key} must be a non-negative integer`);
    }
  }
  if (!Array.isArray(value.entries)) throw new Error("UI asset projection entries must be an array");

  const actualCounts = { characters: 0, weapons: 0, echoes: 0, assets: 0 };
  let previousEntry = null;
  const seenEntries = new Set();

  for (const [entryIndex, entry] of value.entries.entries()) {
    if (!isRecord(entry)) throw new Error(`UI asset entry ${entryIndex} must be an object`);
    assertExactKeys(entry, ["category", "id", "assets"], `UI asset entry ${entryIndex}`);
    if (!CATEGORY_ORDER.has(entry.category)) {
      throw new Error(`UI asset entry ${entryIndex} has an unsupported category`);
    }
    const id = assertSourceId(entry.id, `UI asset entry ${entryIndex} id`);
    const identity = `${entry.category}\u0000${id}`;
    if (seenEntries.has(identity)) throw new Error(`UI asset projection has duplicate entity ${entry.category}:${id}`);
    seenEntries.add(identity);
    if (previousEntry && compareEntries(previousEntry, entry) >= 0) {
      throw new Error("UI asset projection entries are not canonically sorted");
    }
    previousEntry = entry;

    if (!Array.isArray(entry.assets) || entry.assets.length === 0) {
      throw new Error(`UI asset entry ${entry.category}:${id} must contain assets`);
    }
    let previousRole = null;
    const seenRoles = new Set();
    for (const [assetIndex, asset] of entry.assets.entries()) {
      if (!isRecord(asset)) throw new Error(`UI asset ${entry.category}:${id}:${assetIndex} must be an object`);
      assertExactKeys(asset, ["role", "path"], `UI asset ${entry.category}:${id}:${assetIndex}`);
      const role = assertRole(asset.role, `UI asset ${entry.category}:${id}:${assetIndex} role`);
      assertLocalAssetPath(asset.path, `UI asset ${entry.category}:${id}:${role} path`);
      if (seenRoles.has(role)) throw new Error(`UI asset projection has duplicate role ${entry.category}:${id}:${role}`);
      if (previousRole !== null && previousRole >= role) {
        throw new Error(`UI asset roles for ${entry.category}:${id} are not canonically sorted`);
      }
      seenRoles.add(role);
      previousRole = role;
      actualCounts.assets += 1;
    }
    actualCounts[entry.category] += 1;
  }

  for (const key of ["characters", "weapons", "echoes", "assets"]) {
    if (actualCounts[key] !== value.counts[key]) {
      throw new Error(`UI asset projection count mismatch for ${key}`);
    }
  }
  return value;
}

export const wuwaUiAssetCategoriesV1 = CATEGORIES;
