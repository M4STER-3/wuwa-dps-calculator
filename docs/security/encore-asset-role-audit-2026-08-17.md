# Encore Release asset-role audit — 2026-08-17

## Purpose

This audit reviewed which logical image-role keys the hardened WuWa asset synchronizer actually discovers in the live English Encore `Release` dataset before application code assigns semantic meanings such as "character head icon" or "weapon icon".

The goal was to avoid choosing image roles from assumptions, display names, URL filenames or a handful of manually inspected entities.

## Execution boundary

The audit ran once from a disposable GitHub branch with repository permissions limited to `contents: read`.

Before contacting Encore it:

- installed the locked dependency graph with lifecycle scripts disabled;
- verified npm registry signatures and provenance;
- ran the asset synchronization hostile-input tests successfully.

The live step then executed `npm run assets:sync:dry`.

Dry-run mode queried the reviewed Encore list/detail JSON endpoints and discovered candidate image associations, but **did not download or write image bytes** and did not replace the production asset manifest.

The audit summary contained category, stable source IDs and normalized asset-role keys only. It did not publish remote source URLs.

## Result

The live dry-run observed:

- **3,688** logical asset associations;
- **49** distinct category/role combinations;
- assets for **60 / 60 characters**;
- assets for **120 / 120 weapons**;
- assets for **287 / 287 Echo source entries**.

No role whose normalized path matched the synchronizer's advertisement/sponsor/tracking/promo denylist reached the audit output.

## Reviewed universal semantic roles

Only roles with full observed category coverage are currently promoted into `GameAssetSemanticRole`.

### Character head icon

- semantic role: `character-head-icon`
- manifest category: `characters`
- exact asset key: `list-roleheadicon`
- live coverage: **60 / 60**

### Weapon icon

- semantic role: `weapon-icon`
- manifest category: `weapons`
- exact asset key: `list-icon`
- live coverage: **120 / 120**

### Echo icon

- semantic role: `echo-icon`
- manifest category: `echoes`
- exact asset key: `list-icon`
- live coverage: **287 / 287**

The semantic resolver never falls back between these categories.

## Character detail-role finding

Several attractive-looking character detail roles were observed for only **4 / 60** characters, including:

- `detail-roleheadicon`;
- `detail-roleheadiconbig`;
- `detail-roleheadiconcircle`;
- `detail-roleheadiconlarge`;
- `detail-roleportrait`;
- `detail-rolestand`.

These are therefore **not** approved as universal character roles.

In particular, `detail-roleportrait` must not become a required portrait merely because its name looks semantically correct. A future optional portrait/fallback policy needs a separate reviewed coverage decision.

## Other observed Echo roles

The source also provided full 287-entry coverage for several Echo-specific keys, including:

- `detail-icon`;
- `detail-iconmiddle`;
- `detail-iconsmall`;
- `detail-skill-battleviewicon`;
- `detail-element-icon` / `detail-elementicon`;
- `list-iconmiddle`;
- `list-iconsmall`;
- `list-element-icon`;
- `list-fettergroups-0-icon`.

These are intentionally **not** promoted automatically. Their exact UI semantics require a concrete use case and reviewed choice; full coverage alone does not prove the correct meaning.

## Security interpretation

No malicious image payload was tested in this dry-run because image bytes were not downloaded. The audit validates role discovery and source coverage, not the binary content of images.

Binary image safety remains the responsibility of the hardened synchronization pipeline, which separately enforces HTTPS/host allowlists, no redirects, content-type plus file-signature validation, image/total-transfer budgets, SHA-256 content addressing, atomic writes and hostile-input tests.

The runtime `GameAssetRegistry` adds another boundary after synchronization:

- it validates the local manifest again;
- it joins only by category + Encore source ID;
- it validates source URLs but does not expose them to application code;
- it omits source display names;
- it requires a local SHA-256 object path consistent with MIME type;
- semantic roles use exact audited asset keys.

## Change policy

Adding or changing a universal semantic asset role requires a new reviewed role-coverage audit. Application code must not silently introduce fallback keys based on display names, URL paths or unreviewed detail fields.

A later full security review is still required after real binary synchronization, canonical Game Database generation and final application integration are complete.
