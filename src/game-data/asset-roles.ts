import type {
  GameAssetCategory,
  GameAssetRecord,
  GameAssetRegistry,
} from "./asset-registry";

export type GameAssetSemanticRole =
  | "character-head-icon"
  | "weapon-icon"
  | "echo-icon";

interface GameAssetSemanticRoleDefinition {
  readonly category: GameAssetCategory;
  readonly assetKeys: readonly string[];
}

/**
 * These roles are intentionally limited to keys that had complete coverage in
 * the 2026-08-17 read-only Encore Release asset-role audit:
 *
 * - characters:list-roleheadicon -> 60 / 60 characters
 * - weapons:list-icon -> 120 / 120 weapons
 * - echoes:list-icon -> 287 / 287 Echo source entries
 *
 * Detail character portraits/head icons are not included here because the same
 * audit only observed them for 4 / 60 characters. New semantic roles require a
 * separate reviewed coverage audit instead of being inferred from key names.
 */
const SEMANTIC_ROLE_DEFINITIONS = Object.freeze({
  "character-head-icon": Object.freeze({
    category: "characters",
    assetKeys: Object.freeze(["list-roleheadicon"]),
  }),
  "weapon-icon": Object.freeze({
    category: "weapons",
    assetKeys: Object.freeze(["list-icon"]),
  }),
  "echo-icon": Object.freeze({
    category: "echoes",
    assetKeys: Object.freeze(["list-icon"]),
  }),
} satisfies Readonly<Record<GameAssetSemanticRole, GameAssetSemanticRoleDefinition>>);

export function getGameAssetSemanticRoleDefinition(
  role: GameAssetSemanticRole,
): GameAssetSemanticRoleDefinition {
  return SEMANTIC_ROLE_DEFINITIONS[role];
}

/**
 * Resolve a reviewed semantic role through the local content-addressed registry.
 * This function never falls back across categories, display names or remote URLs.
 */
export function resolveGameAssetByRole(
  registry: GameAssetRegistry,
  role: GameAssetSemanticRole,
  encoreSourceId: string,
): GameAssetRecord | undefined {
  const definition = SEMANTIC_ROLE_DEFINITIONS[role];
  return registry.firstMatching(
    definition.category,
    encoreSourceId,
    definition.assetKeys,
  );
}
