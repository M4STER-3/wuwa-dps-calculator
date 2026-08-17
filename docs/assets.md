# WuWa asset sync

The asset sync is intentionally separate from UI/domain integration.

## Commands

- `npm run assets:sync:dry` inspects Encore.moe Release data and reports what would be downloaded.
- `npm run assets:sync` downloads accepted images and writes `public/assets/wuwa/manifest.json`.
- `npm run assets:sync -- --force` re-downloads assets even when the manifest already references the same source URL.

## Stable association model

Assets are keyed by the source entity ID, not by display name. This prevents a rename, localization change, or filename normalization from breaking future associations.

Example manifest shape:

```json
{
  "schemaVersion": 1,
  "gameVersion": "Release",
  "categories": ["characters", "weapons", "echoes"],
  "entities": {
    "characters": {
      "1102": {
        "sourceId": "1102",
        "entityKey": "characters:1102",
        "name": "Example",
        "assets": {
          "roleheadicon": {
            "path": "/assets/wuwa/characters/1102/roleheadicon.webp",
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

Future domain integration should add an explicit source-ID mapping to the relevant resonator, weapon, or echo and resolve images through this manifest. Do not use display names as the primary join key.

The asset key is derived from the API field path. This allows one entity to keep several distinct images without overwriting them.

## Current scope

For now the synchronizer reads only the Encore.moe `Release` collections for:

- characters
- weapons
- echoes

These three categories may also query their detail endpoint by stable ID so image variants absent from the list response can still be discovered. No other asset category is synchronized at this stage.

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
- output paths are normalized and verified to remain under `public/assets/wuwa`;
- files are written atomically through a temporary file before rename;
- downloaded content is never executed;
- SHA-256 and byte size are recorded in the manifest;
- only Encore's `Release` dataset is used, never Beta.

If Encore changes its image delivery to another host, the synchronizer will reject it until that host is explicitly reviewed and allowlisted.
