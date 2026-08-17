# WuWa asset sync

The asset sync is intentionally separate from UI/domain integration.

## Commands

- `npm run assets:sync:dry` inspects Encore.moe Release data and reports what would be downloaded or deduplicated.
- `npm run assets:sync` downloads accepted images and writes `public/assets/wuwa/manifest.json`.
- `npm run assets:sync -- --force` re-fetches remote assets, while still deduplicating identical file content locally.

## Stable association model

Assets are keyed by the source entity ID, not by display name. This prevents a rename, localization change, or filename normalization from breaking future associations.

The manifest uses schema version 2 and maps each logical asset to a content-addressed object:

```json
{
  "schemaVersion": 2,
  "gameVersion": "Release",
  "categories": ["characters", "weapons", "echoes"],
  "storage": {
    "strategy": "sha256-content-addressed",
    "root": "/assets/wuwa/objects"
  },
  "entities": {
    "characters": {
      "1102": {
        "sourceId": "1102",
        "entityKey": "characters:1102",
        "name": "Example",
        "assets": {
          "roleheadicon": {
            "path": "/assets/wuwa/objects/<sha256>.webp",
            "sourceUrl": "https://...",
            "contentType": "image/webp",
            "bytes": 12345,
            "sha256": "..."
          }
        }
      }
    }
  }
}
```

The asset key is derived from the API field path. This allows one entity to keep several distinct image roles without overwriting them.

## Runtime Asset Registry V1

`src/game-data/asset-registry.ts` is the reviewed boundary between the synchronization manifest and application code.

The join is explicit:

`category + Encore source ID -> local manifest entity -> explicit asset role -> local SHA-256 object path`

The registry deliberately does **not** join by display name and does not expose manifest display names to consumers.

It also validates but then removes `sourceUrl` from its runtime-facing records. Application/UI code receives only:

- the normalized asset role key;
- the local `/assets/wuwa/objects/<sha256>.<ext>` path;
- image MIME type;
- byte size;
- SHA-256 digest.

This means application code cannot accidentally switch from a local object back to a remote Encore URL merely by using the registry API.

The registry has no automatic notion of a "primary" image. A caller that wants a portrait/icon must provide a reviewed ordered list of exact asset role keys to `firstMatching(...)`. This avoids choosing an image because its display name or remote URL happens to look suitable.

### Runtime manifest validation

The registry treats even the local manifest as untrusted structured input. It fails closed unless:

- schema version is exactly 2;
- source is `Encore.moe` and source API is exactly `https://api-v2.encore.moe/api/en`;
- game version is `Release`;
- categories are exactly characters, weapons and echoes;
- storage strategy is SHA-256 content-addressed under `/assets/wuwa/objects`;
- category/entity/asset counts remain within the same bounded model as the sync;
- source IDs are bounded and reject dangerous object keys;
- `entityKey` exactly matches `category:sourceId`;
- asset keys use the synchronizer's normalized safe character set;
- only PNG/JPEG/WebP records are accepted;
- byte size is positive and no greater than 8 MiB;
- the local object path is exactly derived from the recorded SHA-256 and MIME type;
- the manifest `sourceUrl` remains an HTTPS Encore-domain URL before it is discarded from the returned runtime record.

Tests cover external URLs, path/hash mismatch, MIME/extension mismatch, dangerous object keys, bad entity IDs/keys, unexpected categories, oversized records and content-addressed deduplication.

## Duplicate prevention and updates

Physical image files are stored by SHA-256 content hash under `public/assets/wuwa/objects`.

This means:

- the same image referenced by several entities or fields is stored only once;
- the same image returned through different URLs is stored only once;
- an Encore URL that has already been synchronized can reuse the existing verified object without downloading it again;
- if an existing content-addressed file is present, its actual SHA-256 is rechecked before reuse;
- `--force` may re-fetch a URL, but identical bytes still resolve to the same physical object;
- after a fully successful synchronization, unreferenced content-addressed objects are removed;
- if any asset fails during synchronization, the previous successful manifest is kept instead of replacing it with a partial manifest.

So future refreshes do not create duplicate files merely because a source URL, API field, or logical association changes.

## Current scope

For now the synchronizer reads only the Encore.moe `Release` collections for:

- characters
- weapons
- echoes

These three categories may also query their detail endpoint by stable ID so image variants absent from the list response can still be discovered. No other asset category is synchronized at this stage.

The registry integration is additive: it does not yet select UI portraits/icons and it does not modify Character Box, the Game Catalog, combat engines or `finalStats`.

## Safety boundaries

The downloader is intentionally fail-closed:

- HTTPS only;
- API requests must use the exact `https://api-v2.encore.moe` origin;
- image hosts must be `encore.moe` or one of its subdomains;
- redirects are rejected;
- URL credentials, custom ports, and fragments are rejected;
- only PNG, JPEG, and WebP are accepted;
- the HTTP content type must exactly match an allowed image type;
- the actual file signature must also match the declared image type;
- SVG, GIF, AVIF, HTML, JavaScript, archives, and executables are rejected;
- each image is capped at 8 MiB while streaming, so a missing or false `Content-Length` cannot bypass the limit;
- JSON responses are capped at 8 MiB;
- requests time out after 15 seconds;
- category size, nested payload depth, visited nodes, and image count per entity are bounded;
- output paths are normalized and verified to remain under the WuWa asset root;
- files are written atomically through a temporary file before rename;
- content-addressed files are verified by SHA-256 before reuse;
- downloaded content is never executed;
- SHA-256 and byte size are recorded in the manifest;
- a partial/failed synchronization does not replace the last successful manifest;
- only Encore's `Release` dataset is used, never Beta.

If Encore changes its image delivery to another host, the synchronizer and runtime registry will reject it until that host is explicitly reviewed and allowlisted.
