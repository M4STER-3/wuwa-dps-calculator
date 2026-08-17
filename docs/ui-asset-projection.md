# WUWA LAB browser-safe asset projection

Status: **Visual redesign Step 8 / 20**

Step 8 creates the narrow browser boundary between the already verified local Wuthering Waves asset manifest and future image-led UI. It does **not** render game artwork yet; Step 9 is the first presentation proof.

## Source and generated output

Source manifest:

- `public/assets/wuwa/manifest.json`
- schema version 2
- generated and verified by the existing asset synchronization pipeline

Projection implementation:

- `scripts/lib/wuwa-ui-asset-projection.mjs`
- `scripts/generate-wuwa-ui-asset-projection-v1.mjs`
- `src/game-data/ui-asset-projection.ts`

Generated browser file:

- `public/data/wuwa/ui-asset-projection-v1.json`
- exposed through same-origin `/api/wuwa/ui-assets`

The projection is regenerated before development, Next.js builds, Cloudflare builds, previews, uploads, and deployments.

## Allowed browser shape

The V1 projection contains only:

- `category`: `characters`, `weapons`, or `echoes`;
- `id`: the exact stable Encore/source ID already stored by the verified manifest;
- `role`: the normalized manifest asset role;
- `path`: a same-origin content-addressed local path.

A projected entry has the conceptual shape:

```json
{
  "category": "characters",
  "id": "<stable source id>",
  "assets": [
    {
      "role": "list-roleheadicon",
      "path": "/assets/wuwa/objects/<64 hex sha256>.png"
    }
  ]
}
```

IDs are values inside arrays rather than untrusted object keys in the browser projection.

## Deliberately excluded data

The browser projection does not contain:

- Encore/source URLs;
- entity names;
- imported descriptions or prose;
- MIME metadata;
- byte counts;
- SHA fields as metadata;
- raw source payloads;
- GameDatabase combat fields;
- formulas, conditions, timers, effects, or stats;
- Character Box persistence;
- `UserBuild.finalStats`.

The SHA remains only as part of the already content-addressed local filename.

## Local-path contract

Every browser-visible asset path must match exactly:

`/assets/wuwa/objects/<64 lowercase hex characters>.(png|jpg|webp)`

The projection rejects:

- `http:` or `https:` asset URLs;
- protocol-relative URLs;
- `javascript:` values;
- `..` traversal;
- paths outside the existing local object store;
- unsupported file extensions;
- manifest paths whose hash or MIME metadata disagrees with the content-addressed filename.

This means later UI code never needs to accept a source-provided image URL.

## Identity contract

Future consumers resolve images by:

1. exact category;
2. exact stable source ID;
3. exact asset role, or an explicit ordered list of preferred roles.

`findWuwaUiAssetPathV1()` implements this lookup boundary.

There is no fuzzy matching, display-name matching, slug guessing, filename guessing, or URL construction from source content.

## Runtime validation

`isWuwaUiAssetProjectionV1()` validates the downloaded JSON before UI code treats it as trusted projection data. It checks:

- exact root/count/entry/asset fields;
- supported schema versions;
- supported categories;
- bounded source IDs and role strings;
- local content-addressed paths only;
- no duplicate entity identity;
- no duplicate role per entity;
- projection counts matching the actual payload.

Unknown fields cause validation failure instead of being silently carried into the UI boundary.

## Generation safety

The generator:

- reads only the verified local V2 asset manifest;
- bounds source and generated file sizes;
- requires regular source files;
- rejects symlink source/output/temp paths;
- checks real input/output directories remain within the repository;
- writes through a temporary file and atomic rename;
- derives the projection deterministically from validated manifest records.

## Security tests

`scripts/test-wuwa-ui-asset-projection-security.mjs` covers:

- canonical projection;
- source metadata exclusion;
- external URL rejection;
- traversal rejection;
- hash/path mismatch rejection;
- MIME/path mismatch rejection;
- unsupported manifest schema/category rejection;
- source identity mismatch rejection;
- malicious role rejection;
- dangerous source-ID rejection;
- unknown browser fields rejection;
- duplicate entity/role rejection;
- canonical ordering checks;
- count-integrity checks.

`src/game-data/ui-asset-projection.test.ts` additionally checks browser runtime validation and exact-ID / explicit-role resolution.

The security workflow executes the projection security test explicitly, while normal `npm test` also includes it.

## Presentation boundary

Step 8 intentionally does not put any real image into Character Box, Echoes, Home, DPS, or Game Data.

Step 9 will use this projection with the Step 7 illustrated-card system to render a small cross-category proof. That checkpoint will validate:

- actual asset roles and image suitability;
- crop / `object-fit` behaviour;
- fallback behaviour;
- image loading and dimensions;
- whether the composition still feels too geometric once real artwork is present.

Only after that visual checkpoint should the image system be carried into Character Box.

## Combat architecture boundary

This projection is presentation metadata only. It cannot change combat behaviour.

`UserBuild.finalStats` remains the sole permanent-stat source consumed by runtime combat engines, and no Damage / State / Temporal / Build Resolver semantics are modified by Step 8.
