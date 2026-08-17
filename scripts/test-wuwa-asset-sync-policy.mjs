import assert from "node:assert/strict";
import {
  AssetSyncHttpError,
  isRequiredUniversalAssetRole,
  isSkippableOptionalMissingAsset,
  requiredUniversalAssetRoles,
} from "./lib/wuwa-asset-sync-policy.mjs";

assert.deepEqual(requiredUniversalAssetRoles.characters, ["list-roleheadicon"]);
assert.deepEqual(requiredUniversalAssetRoles.weapons, ["list-icon"]);
assert.deepEqual(requiredUniversalAssetRoles.echoes, ["list-icon"]);

assert.equal(isRequiredUniversalAssetRole("characters", "list-roleheadicon"), true);
assert.equal(isRequiredUniversalAssetRole("weapons", "list-icon"), true);
assert.equal(isRequiredUniversalAssetRole("echoes", "list-icon"), true);
assert.equal(isRequiredUniversalAssetRole("characters", "detail-roleportrait"), false);
assert.equal(isRequiredUniversalAssetRole("echoes", "detail-skill-battleviewicon"), false);

const missing = new AssetSyncHttpError(404);
assert.equal(
  isSkippableOptionalMissingAsset("characters", "detail-roleportrait", missing),
  true,
);
assert.equal(
  isSkippableOptionalMissingAsset("echoes", "detail-skill-battleviewicon", missing),
  true,
);
assert.equal(
  isSkippableOptionalMissingAsset("characters", "list-roleheadicon", missing),
  false,
);
assert.equal(isSkippableOptionalMissingAsset("weapons", "list-icon", missing), false);
assert.equal(isSkippableOptionalMissingAsset("echoes", "list-icon", missing), false);
assert.equal(
  isSkippableOptionalMissingAsset(
    "characters",
    "detail-roleportrait",
    new AssetSyncHttpError(500),
  ),
  false,
);
assert.equal(
  isSkippableOptionalMissingAsset("characters", "detail-roleportrait", new Error("404")),
  false,
);

console.log("Asset sync required-role policy tests passed.");
