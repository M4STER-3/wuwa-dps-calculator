export class AssetSyncHttpError extends Error {
  constructor(status, message = `Request returned HTTP ${status}`) {
    super(message);
    this.name = "AssetSyncHttpError";
    this.status = status;
  }
}

const REQUIRED_UNIVERSAL_ASSET_KEYS = Object.freeze({
  characters: Object.freeze(new Set(["list-roleheadicon"])),
  weapons: Object.freeze(new Set(["list-icon"])),
  echoes: Object.freeze(new Set(["list-icon"])),
});

export function isRequiredUniversalAssetRole(category, assetKey) {
  const roles = REQUIRED_UNIVERSAL_ASSET_KEYS[category];
  return roles instanceof Set && roles.has(assetKey);
}

/**
 * A 404 for a non-universal image means Encore references an optional object
 * that is not actually present on its image host. It is not treated as a valid
 * asset and is not written into the manifest. All other HTTP failures remain
 * blocking, and a 404 for a universal audited role remains blocking too.
 */
export function isSkippableOptionalMissingAsset(category, assetKey, error) {
  return (
    error instanceof AssetSyncHttpError &&
    error.status === 404 &&
    !isRequiredUniversalAssetRole(category, assetKey)
  );
}

export const requiredUniversalAssetRoles = Object.freeze({
  characters: Object.freeze(["list-roleheadicon"]),
  weapons: Object.freeze(["list-icon"]),
  echoes: Object.freeze(["list-icon"]),
});
