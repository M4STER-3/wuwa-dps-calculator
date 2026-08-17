export type GameAssetCategory = "characters" | "weapons" | "echoes";

export type GameAssetContentType = "image/png" | "image/jpeg" | "image/webp";

export interface GameAssetRecord {
  readonly assetKey: string;
  readonly path: string;
  readonly contentType: GameAssetContentType;
  readonly bytes: number;
  readonly sha256: string;
}

export interface GameAssetEntity {
  readonly category: GameAssetCategory;
  readonly sourceId: string;
  readonly entityKey: string;
  readonly assets: readonly GameAssetRecord[];
}

export interface GameAssetRegistry {
  readonly schemaVersion: 2;
  readonly gameVersion: "Release";
  hasEntity(category: GameAssetCategory, sourceId: string): boolean;
  getEntity(category: GameAssetCategory, sourceId: string): GameAssetEntity | undefined;
  get(category: GameAssetCategory, sourceId: string, assetKey: string): GameAssetRecord | undefined;
  allForEntity(category: GameAssetCategory, sourceId: string): readonly GameAssetRecord[];
  /**
   * Resolve only from an explicit ordered list supplied by reviewed caller code.
   * The registry never guesses an image role from display names or remote URLs.
   */
  firstMatching(
    category: GameAssetCategory,
    sourceId: string,
    preferredAssetKeys: readonly string[],
  ): GameAssetRecord | undefined;
}

export class GameAssetManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameAssetManifestError";
  }
}

const CATEGORIES = ["characters", "weapons", "echoes"] as const satisfies readonly GameAssetCategory[];
const CATEGORY_SET = new Set<string>(CATEGORIES);
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_ENTITIES_PER_CATEGORY = 1_000;
const MAX_TOTAL_ASSETS = 10_000;
const MAX_ASSETS_PER_ENTITY = 96;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_SOURCE_ID_LENGTH = 128;
const MAX_ASSET_KEY_LENGTH = 1_024;
const EXPECTED_STORAGE_ROOT = "/assets/wuwa/objects";
const EXPECTED_SOURCE_API = "https://api-v2.encore.moe/api/en";
const ALLOWED_CONTENT_TYPES: Readonly<Record<GameAssetContentType, string>> = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
});

function fail(message: string): never {
  throw new GameAssetManifestError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${label} must be an object.`);
  return value;
}

function assertSafeObjectKey(value: string, label: string): string {
  if (DANGEROUS_KEYS.has(value)) fail(`${label} uses a forbidden object key.`);
  return value;
}

function parseSourceId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SOURCE_ID_LENGTH) {
    fail(`${label} must be a non-empty string of at most ${MAX_SOURCE_ID_LENGTH} characters.`);
  }
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) {
    fail(`${label} contains control characters.`);
  }
  return assertSafeObjectKey(value, label);
}

function parseAssetKey(value: string, label: string): string {
  if (
    value.length === 0 ||
    value.length > MAX_ASSET_KEY_LENGTH ||
    !/^[a-z0-9._-]+$/.test(value)
  ) {
    fail(`${label} is not a valid normalized asset key.`);
  }
  return assertSafeObjectKey(value, label);
}

function parsePositiveInteger(value: unknown, label: string, max: number): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value <= 0 || value > max) {
    fail(`${label} must be a positive integer no greater than ${max}.`);
  }
  return value;
}

function parseSha256(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    fail(`${label} must be a lowercase SHA-256 hex digest.`);
  }
  return value;
}

function parseContentType(value: unknown, label: string): GameAssetContentType {
  if (
    typeof value !== "string" ||
    !Object.prototype.hasOwnProperty.call(ALLOWED_CONTENT_TYPES, value)
  ) {
    fail(`${label} is not an allowed image MIME type.`);
  }
  return value as GameAssetContentType;
}

function validateSourceUrl(value: unknown, label: string): void {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096) {
    fail(`${label} must be a bounded HTTPS URL.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(`${label} is not a valid URL.`);
  }

  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    (host !== "encore.moe" && !host.endsWith(".encore.moe"))
  ) {
    fail(`${label} points outside the reviewed Encore image boundary.`);
  }
}

function parseAssetRecord(assetKey: string, raw: unknown, label: string): GameAssetRecord {
  const asset = assertRecord(raw, label);
  const sha256 = parseSha256(asset.sha256, `${label}.sha256`);
  const contentType = parseContentType(asset.contentType, `${label}.contentType`);
  const extension = ALLOWED_CONTENT_TYPES[contentType];
  const expectedPath = `${EXPECTED_STORAGE_ROOT}/${sha256}.${extension}`;

  if (asset.path !== expectedPath) {
    fail(`${label}.path must be the local content-addressed path for its SHA-256 and MIME type.`);
  }

  validateSourceUrl(asset.sourceUrl, `${label}.sourceUrl`);

  return Object.freeze({
    assetKey,
    path: expectedPath,
    contentType,
    bytes: parsePositiveInteger(asset.bytes, `${label}.bytes`, MAX_IMAGE_BYTES),
    sha256,
  });
}

function validateTopLevelKeys(record: Record<string, unknown>, label: string, allowed: ReadonlySet<string>): void {
  for (const key of Object.keys(record)) {
    assertSafeObjectKey(key, `${label} key`);
    if (!allowed.has(key)) fail(`${label} contains unexpected key ${JSON.stringify(key)}.`);
  }
}

function parseCategories(value: unknown): void {
  if (!Array.isArray(value) || value.length !== CATEGORIES.length) {
    fail("Asset manifest categories must contain exactly characters, weapons and echoes.");
  }
  const values = new Set<string>();
  for (const category of value) {
    if (typeof category !== "string" || !CATEGORY_SET.has(category)) {
      fail("Asset manifest contains an unknown category.");
    }
    values.add(category);
  }
  if (values.size !== CATEGORIES.length) {
    fail("Asset manifest categories contain duplicates or omissions.");
  }
}

function parseEntity(
  category: GameAssetCategory,
  sourceIdKey: string,
  raw: unknown,
  state: { totalAssets: number },
): GameAssetEntity {
  const entity = assertRecord(raw, `entities.${category}.${sourceIdKey}`);
  const sourceId = parseSourceId(entity.sourceId, `entities.${category}.${sourceIdKey}.sourceId`);
  if (sourceId !== sourceIdKey) {
    fail(`entities.${category}.${sourceIdKey} sourceId does not match its manifest key.`);
  }

  const expectedEntityKey = `${category}:${sourceId}`;
  if (entity.entityKey !== expectedEntityKey) {
    fail(`entities.${category}.${sourceId}.entityKey must equal ${JSON.stringify(expectedEntityKey)}.`);
  }

  const rawAssets = assertRecord(entity.assets, `entities.${category}.${sourceId}.assets`);
  const assetEntries = Object.entries(rawAssets);
  if (assetEntries.length > MAX_ASSETS_PER_ENTITY) {
    fail(`entities.${category}.${sourceId} exceeds ${MAX_ASSETS_PER_ENTITY} assets.`);
  }

  const assets = assetEntries
    .map(([rawAssetKey, rawAsset]) => {
      const assetKey = parseAssetKey(rawAssetKey, `entities.${category}.${sourceId} asset key`);
      state.totalAssets += 1;
      if (state.totalAssets > MAX_TOTAL_ASSETS) {
        fail(`Asset manifest exceeds ${MAX_TOTAL_ASSETS} total assets.`);
      }
      return parseAssetRecord(
        assetKey,
        rawAsset,
        `entities.${category}.${sourceId}.assets.${assetKey}`,
      );
    })
    .sort((left, right) => left.assetKey.localeCompare(right.assetKey));

  return Object.freeze({
    category,
    sourceId,
    entityKey: expectedEntityKey,
    assets: Object.freeze(assets),
  });
}

/**
 * Parse the local content-addressed asset manifest and expose only runtime-safe
 * local asset metadata. `sourceUrl` and manifest display names are validated but
 * deliberately omitted from the returned registry so browser code cannot couple
 * itself back to Encore or join assets by display name.
 */
export function createGameAssetRegistry(rawManifest: unknown): GameAssetRegistry {
  const manifest = assertRecord(rawManifest, "Asset manifest");
  validateTopLevelKeys(
    manifest,
    "Asset manifest",
    new Set([
      "schemaVersion",
      "source",
      "sourceApi",
      "gameVersion",
      "generatedAt",
      "categories",
      "storage",
      "security",
      "entities",
    ]),
  );

  if (manifest.schemaVersion !== 2) fail("Asset manifest schemaVersion must be 2.");
  if (manifest.source !== "Encore.moe") fail("Asset manifest source must be Encore.moe.");
  if (manifest.sourceApi !== EXPECTED_SOURCE_API) fail("Asset manifest sourceApi is not reviewed.");
  if (manifest.gameVersion !== "Release") fail("Asset manifest must target Release.");
  if (typeof manifest.generatedAt !== "string" || !Number.isFinite(Date.parse(manifest.generatedAt))) {
    fail("Asset manifest generatedAt must be a valid timestamp.");
  }
  parseCategories(manifest.categories);

  const storage = assertRecord(manifest.storage, "Asset manifest storage");
  if (
    storage.strategy !== "sha256-content-addressed" ||
    storage.root !== EXPECTED_STORAGE_ROOT
  ) {
    fail("Asset manifest storage strategy/root is not supported.");
  }

  const entitiesRecord = assertRecord(manifest.entities, "Asset manifest entities");
  validateTopLevelKeys(entitiesRecord, "Asset manifest entities", CATEGORY_SET);

  const entityIndexes = new Map<GameAssetCategory, ReadonlyMap<string, GameAssetEntity>>();
  const assetIndexes = new Map<GameAssetCategory, ReadonlyMap<string, ReadonlyMap<string, GameAssetRecord>>>();
  const state = { totalAssets: 0 };

  for (const category of CATEGORIES) {
    const rawCategory = assertRecord(entitiesRecord[category], `entities.${category}`);
    const entries = Object.entries(rawCategory);
    if (entries.length > MAX_ENTITIES_PER_CATEGORY) {
      fail(`entities.${category} exceeds ${MAX_ENTITIES_PER_CATEGORY} entities.`);
    }

    const entities = new Map<string, GameAssetEntity>();
    const assetsByEntity = new Map<string, ReadonlyMap<string, GameAssetRecord>>();
    for (const [rawSourceId, rawEntity] of entries) {
      const sourceId = parseSourceId(rawSourceId, `entities.${category} source ID`);
      const entity = parseEntity(category, sourceId, rawEntity, state);
      entities.set(sourceId, entity);
      assetsByEntity.set(
        sourceId,
        new Map(entity.assets.map((asset) => [asset.assetKey, asset] as const)),
      );
    }
    entityIndexes.set(category, entities);
    assetIndexes.set(category, assetsByEntity);
  }

  const getEntity = (category: GameAssetCategory, sourceId: string) =>
    entityIndexes.get(category)?.get(sourceId);

  return Object.freeze({
    schemaVersion: 2 as const,
    gameVersion: "Release" as const,
    hasEntity: (category: GameAssetCategory, sourceId: string) => Boolean(getEntity(category, sourceId)),
    getEntity,
    get: (category: GameAssetCategory, sourceId: string, assetKey: string) =>
      assetIndexes.get(category)?.get(sourceId)?.get(assetKey),
    allForEntity: (category: GameAssetCategory, sourceId: string) =>
      getEntity(category, sourceId)?.assets ?? Object.freeze([] as GameAssetRecord[]),
    firstMatching: (
      category: GameAssetCategory,
      sourceId: string,
      preferredAssetKeys: readonly string[],
    ) => {
      const index = assetIndexes.get(category)?.get(sourceId);
      if (!index) return undefined;
      for (const assetKey of preferredAssetKeys) {
        const asset = index.get(assetKey);
        if (asset) return asset;
      }
      return undefined;
    },
  });
}
