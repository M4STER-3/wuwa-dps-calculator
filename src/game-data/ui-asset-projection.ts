export type WuwaUiAssetCategoryV1 = "characters" | "weapons" | "echoes";

export interface WuwaUiAssetRoleV1 {
  readonly role: string;
  readonly path: string;
}

export interface WuwaUiAssetEntryV1 {
  readonly category: WuwaUiAssetCategoryV1;
  readonly id: string;
  readonly assets: readonly WuwaUiAssetRoleV1[];
}

export interface WuwaUiAssetProjectionV1 {
  readonly schemaVersion: 1;
  readonly assetManifestSchemaVersion: 2;
  readonly counts: {
    readonly characters: number;
    readonly weapons: number;
    readonly echoes: number;
    readonly assets: number;
  };
  readonly entries: readonly WuwaUiAssetEntryV1[];
}

const categories = new Set<WuwaUiAssetCategoryV1>(["characters", "weapons", "echoes"]);
const dangerousKeys = new Set(["__proto__", "constructor", "prototype"]);
const rolePattern = /^[a-z0-9._-]+$/;
const localAssetPattern = /^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/;
const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isSafeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    !controlCharacters.test(value) &&
    !dangerousKeys.has(value)
  );
}

function isSafeRole(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1024 &&
    rolePattern.test(value) &&
    !dangerousKeys.has(value)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

export function isWuwaUiAssetProjectionV1(value: unknown): value is WuwaUiAssetProjectionV1 {
  if (!isRecord(value) || !hasExactKeys(value, ["schemaVersion", "assetManifestSchemaVersion", "counts", "entries"])) {
    return false;
  }
  if (value.schemaVersion !== 1 || value.assetManifestSchemaVersion !== 2) return false;
  if (!isRecord(value.counts) || !hasExactKeys(value.counts, ["characters", "weapons", "echoes", "assets"])) {
    return false;
  }
  if (
    !isNonNegativeInteger(value.counts.characters) ||
    !isNonNegativeInteger(value.counts.weapons) ||
    !isNonNegativeInteger(value.counts.echoes) ||
    !isNonNegativeInteger(value.counts.assets) ||
    !Array.isArray(value.entries)
  ) {
    return false;
  }

  const actualCounts = { characters: 0, weapons: 0, echoes: 0, assets: 0 };
  const seenEntities = new Set<string>();

  for (const entry of value.entries) {
    if (!isRecord(entry) || !hasExactKeys(entry, ["category", "id", "assets"])) return false;
    if (typeof entry.category !== "string" || !categories.has(entry.category as WuwaUiAssetCategoryV1)) {
      return false;
    }
    if (!isSafeId(entry.id) || !Array.isArray(entry.assets) || entry.assets.length === 0) return false;

    const category = entry.category as WuwaUiAssetCategoryV1;
    const entityKey = `${category}\u0000${entry.id}`;
    if (seenEntities.has(entityKey)) return false;
    seenEntities.add(entityKey);

    const seenRoles = new Set<string>();
    for (const asset of entry.assets) {
      if (!isRecord(asset) || !hasExactKeys(asset, ["role", "path"])) return false;
      if (!isSafeRole(asset.role) || typeof asset.path !== "string" || !localAssetPattern.test(asset.path)) {
        return false;
      }
      if (seenRoles.has(asset.role)) return false;
      seenRoles.add(asset.role);
      actualCounts.assets += 1;
    }
    actualCounts[category] += 1;
  }

  return (
    actualCounts.characters === value.counts.characters &&
    actualCounts.weapons === value.counts.weapons &&
    actualCounts.echoes === value.counts.echoes &&
    actualCounts.assets === value.counts.assets
  );
}

export function findWuwaUiAssetEntryV1(
  projection: WuwaUiAssetProjectionV1,
  category: WuwaUiAssetCategoryV1,
  id: string,
): WuwaUiAssetEntryV1 | undefined {
  return projection.entries.find((entry) => entry.category === category && entry.id === id);
}

export function findWuwaUiAssetPathV1(
  projection: WuwaUiAssetProjectionV1,
  category: WuwaUiAssetCategoryV1,
  id: string,
  preferredRoles: readonly string[],
): string | undefined {
  const entry = findWuwaUiAssetEntryV1(projection, category, id);
  if (!entry) return undefined;
  for (const role of preferredRoles) {
    const asset = entry.assets.find((candidate) => candidate.role === role);
    if (asset) return asset.path;
  }
  return undefined;
}
