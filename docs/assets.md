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
  "entities": {
    "characters": {
      "1102": {
        "sourceId": "1102",
        "entityKey": "characters:1102",
        "name": "Example",
        "assets": {
          "detail-roleheadicon": {
            "path": "/assets/wuwa/characters/1102/detail-roleheadicon.webp",
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

Future domain integration should add an explicit source-ID mapping to the relevant game entity (resonator, weapon, echo, item/stat icon, etc.) and resolve images through this manifest. Do not use display names as the primary join key.

The asset key is derived from the API field path. This allows one entity to keep several distinct images (portrait, head icon, skill icon, background, and so on) without overwriting them.

## Current categories

The first version reads the Encore.moe `Release` collections for:

- characters
- weapons
- echoes
- monsters
- items
- namecards
- phones
- titles

Characters, weapons, echoes, and monsters also query their documented detail endpoint by stable ID so image variants that are absent from the list response can still be discovered. This is especially useful for future character/skill/stat presentation.

## Safety boundaries

The downloader:

- uses only `https`;
- accepts only `encore.moe` or its subdomains as image hosts;
- rejects redirects;
- caps each image at 12 MiB;
- validates PNG, JPEG, WebP, GIF, or AVIF using file signatures in addition to the HTTP content type;
- never executes downloaded content;
- writes a SHA-256 digest and byte size into the manifest;
- uses Encore's `Release` dataset rather than Beta.

If Encore moves image delivery to a third-party CDN, the script will fail closed instead of silently trusting the new host. That host should be reviewed before being added to the allowlist.
