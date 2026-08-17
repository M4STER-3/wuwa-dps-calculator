# Controlled WuWa asset promotion

The asset synchronizer is intentionally not allowed to write directly to `main`.

## Goal

Materialize the reviewed Encore.moe `Release` image set in GitHub while keeping the same stable association model used by the runtime registry:

`category + Encore source ID -> semantic asset role -> local SHA-256 object path`

The promoted tree is limited to:

- `public/assets/wuwa/manifest.json`
- `public/assets/wuwa/objects/<sha256>.<ext>`

No browser, combat-engine, Character Box, `finalStats`, or curated combat-data file is part of an asset promotion.

## Promotion trigger

The workflow `.github/workflows/promote-wuwa-assets.yml` only reacts to a one-shot `.github/asset-promotion.trigger` file pushed on a branch whose name starts with `asset-promotion/`.

The workflow has `contents: write` and `pull-requests: write` because its only job is to prepare a promotion branch and open a PR. It never pushes to `main`.

A promotion run:

1. starts from a clean promotion branch;
2. reruns the asset policy and hostile-input tests;
3. performs a fresh `Release` synchronization with `--force`;
4. runs `scripts/verify-wuwa-assets.mjs` as an independent second verifier;
5. enforces a GitHub promotion ceiling of 5,000 physical objects and 256 MiB;
6. rejects any generated change outside `public/assets/wuwa` (apart from deleting the one-shot trigger);
7. commits the verified asset tree back to the promotion branch;
8. opens a normal PR against `main` when the asset tree changed.

Normal PR CI still runs before merge.

## Independent verifier

`npm run assets:verify` re-opens the generated manifest and every referenced object without trusting the synchronizer's in-memory result.

It fails closed unless:

- the manifest is valid bounded UTF-8 JSON with the reviewed schema/source/API/Release/storage values;
- categories are exactly characters, weapons and echoes;
- source IDs, entity keys, asset keys and record shapes are valid;
- required universal roles exist on every entity;
- advertisement/tracking/promotion role names are absent;
- every source URL remains HTTPS on `encore.moe` or an Encore subdomain;
- every object path is exactly derived from SHA-256 plus MIME type;
- every file is regular (not a symlink), within the object store, no larger than 8 MiB, and has the expected PNG/JPEG/WebP signature;
- every file's real SHA-256 and byte size match its manifest record;
- every manifest reference has a physical object and every physical object is referenced;
- the existing 10,000-logical-asset and 96-assets-per-entity ceilings remain unchanged.

`npm run assets:test-verifier` exercises the verifier against corruption, orphan files, an external source URL, advertising-role injection, and missing required-role cases.

## Duplicate behavior

Promotion keeps the content-addressed storage strategy. Identical bytes always resolve to the same SHA-256 filename, even if multiple IDs or semantic roles reference them. A later refresh therefore reuses unchanged object identities instead of creating filename-based duplicates.

The manifest remains the only mapping from Encore IDs/roles to those local objects. Runtime application code consumes the validated `GameAssetRegistry` and does not receive the remote Encore URL.
