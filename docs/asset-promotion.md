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

## Resumable three-batch promotion

A promotion is split into three ordered checkpoints:

1. `characters`;
2. `weapons`;
3. `echoes`, followed by global finalization.

The first checkpoint resets the in-progress manifest so a new promotion cannot silently mix old category metadata with the new Release snapshot. Each completed category checkpoint is committed immediately to the promotion branch. The trigger remains in place until finalization.

If a later category fails, the earlier checkpoint commits remain on the promotion branch. Updating the one-shot trigger starts a new workflow run from that checkpoint, so already-completed categories do not need to be downloaded again.

The checkpoints are not three independent asset systems. They all share the same content-addressed object store and build one manifest. The Echo checkpoint performs global required-role validation and prunes objects that are not referenced by the final combined manifest.

The workflow still uses `--force` for the category being processed. That category is freshly fetched from Encore instead of trusting a previous URL mapping. Identical bytes across categories still collapse to the same SHA-256 object file.

## Promotion controls

Before and during promotion, the workflow:

- requires an `asset-promotion/**` branch;
- rejects branch differences outside `.github/asset-promotion.trigger` and `public/assets/wuwa`;
- reruns the asset policy and hostile-input tests;
- only accepts the three explicit categories;
- permits `--reset-manifest` only for the character checkpoint;
- permits `--finalize` only for the Echo checkpoint;
- uses `git status --porcelain=v1 -uall` so thousands of untracked asset files are inspected individually rather than collapsed to a parent directory;
- commits only `public/assets/wuwa` at intermediate checkpoints;
- independently verifies the complete final manifest and every referenced binary;
- enforces a GitHub promotion ceiling of 5,000 physical objects and 256 MiB;
- removes the one-shot trigger only after final verification;
- opens a normal PR against `main` rather than writing directly to `main`.

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

## First live promotion observation

The first monolithic promotion attempt on 2026-08-17 successfully completed the live Release download in roughly 28 minutes and also passed the independent binary verifier and repository-footprint cap. It then failed before commit because Git grouped the untracked object tree as `public/assets/`, while the path guard expected individual `public/assets/wuwa/...` paths. No asset was promoted by that failed run.

The batched workflow fixes that path-enumeration bug and preserves successful category checkpoints so a late workflow error cannot discard all previous download work.
