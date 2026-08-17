# Encore Game Data Importer V1

The importer treats Encore as an untrusted data source. It does not execute remote content and it does not normalize descriptive data into combat rules.

## Scope

V1 acquires the current Encore `Release` dataset for:

- characters: list + one detail request per source ID;
- weapons: list + one detail request per source ID;
- Echoes: list + one detail request per source ID.

The current Encore API documentation exposes these resources under `https://api-v2.encore.moe/api/{lang}`. The importer fixes the language to `en` and the dataset to `Release`.

A first live Release audit on 2026-08-17 confirmed the source shapes used by the reviewed normalizer. The detailed security findings are recorded in `docs/security/encore-live-audit-2026-08-17.md`.

## Commands

```bash
npm run game-data:test-security
npm run game-data:import:audit
npm run game-data:import
npm run game-data:test-normalizer-security
npm run game-data:normalize
```

`game-data:test-security` uses a mocked transport and never contacts Encore.

`game-data:import:audit` contacts Encore but never promotes RAW data into `data/`. It leaves only three non-RAW audit files in the ignored `.tmp/wuwa-game-data-audit/` directory:

- `manifest.json` — request hashes, sizes, source IDs, counts and diff metadata;
- `schema-report.json` — observed JSON paths and value types;
- `field-inventory.json` — bounded observations for scalar text/number/boolean fields so reviewed mappings can be designed from real data.

`field-inventory.json` is deliberately safer than copying the RAW payload into an artifact. Normal text samples are whitespace-normalized and capped at 240 characters. HTTP(S) values are represented by scheme + hostname only. Strings that look like HTML or script-bearing content are counted and flagged but their raw value is omitted from samples.

`game-data:import` performs the same acquisition and validation and promotes the fully validated snapshot to `data/sources/encore/release/` only after the complete run succeeds. The promoted RAW snapshot also contains the schema and field-inventory reports for reproducible local normalization work.

`game-data:normalize` is an offline, fixed-path transformation. It reads only the validated RAW snapshot and writes a reviewed source-normalized preview to `.tmp/wuwa-game-data-normalized/normalized-source.json`. It has no network code and accepts no filesystem/URL arguments.

The normalized preview includes a SHA-256 provenance index for every character, weapon and Echo detail payload. This allows any normalized source entity to be traced back to the exact validated RAW bytes that produced it without copying remote URLs into browser-facing data.

`game-data:test-normalizer-security` first builds a mocked valid RAW snapshot, then proves that the normalizer strips source rich-text to inert plain text, removes unknown fields by rebuilding allowlisted shapes, rejects allowlisted script-like/URL-bearing text, rejects unsafe paths/symlinks, preserves legitimate source entries with missing display names without inventing names, removes all temporary normalization sentinels, preserves SHA-256 provenance and produces deterministic output.

## Network boundary

The network client is intentionally narrow:

- exact origin: `https://api-v2.encore.moe`;
- exact API family: `/api/en/character`, `/weapon`, `/echo` and their ID detail routes;
- HTTPS only;
- query string contains only `v=Release`;
- GET only;
- `Accept: application/json`;
- redirects disabled;
- URL credentials, custom ports and fragments are not accepted;
- response content type must be `application/json`;
- per-response and total-transfer byte budgets are enforced while streaming;
- requests have a timeout.

An URL found inside an Encore payload is data only. It is never passed back into `fetch()`. This prevents advertisements, tracking links, download links or compromised payload fields from choosing a new network destination.

## JSON quarantine and validation

Downloaded bytes remain in a temporary ignored quarantine directory until the whole run succeeds.

Before a payload is accepted it must be:

- valid UTF-8;
- valid JSON;
- within depth/node/array/object/string/key limits;
- free of dangerous object keys such as `__proto__`, `prototype` and `constructor`;
- part of an expected list collection;
- composed of entities with bounded, stable source IDs;
- free of duplicate source IDs within a resource family.

The importer stores only `.json` files. Remote data cannot select output paths; detail filenames are derived from SHA-256 of the validated source ID.

## Last-known-good policy

The importer is fail-closed.

A failed list request, failed detail request, invalid payload, duplicate ID, unsafe key, exceeded resource budget or filesystem safety error prevents promotion.

Before replacing an existing snapshot, the importer compares source IDs with the previous manifest. If any previously known character, weapon or Echo disappears, the run is blocked and the previous snapshot remains authoritative. There is no automatic removal flag in V1.

Promotion uses a staged directory and a recoverable directory swap so an incomplete network run cannot progressively overwrite the current RAW snapshot.

## Field discovery and live audit

`schema-report.json` records observed JSON paths and value types up to a bounded depth.

`field-inventory.json` adds bounded scalar observations that are useful for mapping actual game information:

- string occurrence count and min/max length;
- up to three safe, capped text samples per path;
- URL-like, HTML-like, script-like and control-character counts;
- numeric occurrence count, integer count and min/max values;
- boolean true/false counts.

The first live audit observed 60 characters, 120 weapons and 287 Echo entries. It confirmed source fields for character identity/element/weapon/skills/sequences/properties, weapon identity/type/properties/passive templates, Echo skills and repeated Sonata definitions/effect thresholds.

The same audit also found many URL-like and rich-text-like source strings. Generated browser-facing text therefore always goes through the normalizer's inert plain-text boundary; source markup is not trusted presentation code.

A follow-up live normalization probe found at least one legitimate source skill (`character 1305`, source skill `1002308`) whose `SkillName` is an empty string while its type is `Inherent Skill` and its description is populated. The source-normalized layer therefore preserves such entries without a `name` field and emits a data-quality diagnostic instead of deleting the information or inventing a display name.

## Reviewed normalizer mapping

The V1 source normalizer currently maps only fields confirmed by the live audit.

Characters include:

- source ID, name, element, weapon type, rarity and max level;
- named source properties with base values and source growth points;
- skill IDs, optional source display names, types, plain-text descriptions and source attribute/value arrays;
- six Resonance Chain nodes with names and plain-text descriptions;
- permanent property-node titles/descriptions from the source skill tree.

A missing skill display name is not synthesized. The source ID, type and reviewed content remain available for the future canonical generator to classify explicitly.

Weapons include:

- source ID, name, weapon type and rarity;
- descriptive text;
- named source properties and source growth points;
- passive name, inert plain-text description template and rank parameter sets;
- breach index and level-limit metadata.

Echoes include:

- source ID, name, source element/quality/rarity/intensity metadata;
- Echo skill summary/description/cooldown;
- source Sonata group IDs;
- Sonata set names and generic piece thresholds paired with inert effect descriptions.

Repeated Sonata definitions are deduplicated by name and must agree on their piece/effect definitions. Conflicting definitions fail normalization rather than silently choosing one. Echo-local Sonata lore/definition text remains RAW-only because the live source contains duplicated and occasionally mixed-language variants.

## Explicitly unresolved mappings

The normalizer deliberately does **not** guess two important concepts yet:

1. Character/weapon `GrowthValues.level` is preserved as `sourceLevelIndex`. The live source currently reports indexes up to 48; those values are not silently reinterpreted as game levels 1–90.
2. Echo `Rarity`, `QualityId`, `LevelUpGroupId` and handbook intensity are preserved as source metadata. Echo cost 1/3/4 is not generated until the mapping is independently verified.

Structured source `DamageList`, internal condition strings and formula-like values remain evidence in RAW data only. They are not automatically translated into executable `CombatEffect` or Damage Engine rules.

The current flow is:

`RAW snapshot -> reviewed source normalizer -> normalized preview -> future canonical Game Database generator`

The next generator step will add canonical calculator identities and translate only verified normalized fields into `GameDatabaseV1`. Unknown fields can remain in RAW data, but only reviewed allowlisted fields may enter generated catalog entries.

## GitHub live audit

`.github/workflows/encore-import-audit.yml` remains manual-only (`workflow_dispatch`) on `main`. It has read-only repository permissions, no deployment secrets, no write permission to `main`, installs locked dependencies with lifecycle scripts disabled, verifies npm signatures/provenance, runs the mock attack tests, then performs `game-data:import:audit`.

Only the audit manifest, schema report and safe field inventory are uploaded as a short-lived GitHub artifact. RAW payloads are not uploaded by this workflow.
