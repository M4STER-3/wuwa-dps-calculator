# Normalized Encore -> GameDatabaseV1 bridge plan

This document prepares the next data step while asset promotion runs. It does not change combat behavior.

## Boundary

Input: the already-sanitized normalized Encore snapshot produced by `scripts/normalize-wuwa-game-data.mjs`.

Output: a generated `GameDatabaseV1` artifact that satisfies `src/game-data/schema.ts` and passes `createGameCatalog(...)` validation.

The bridge must never:

- read raw Encore JSON directly;
- execute source text, formulas, conditions, URLs, or markup;
- modify `UserBuild.finalStats`;
- reconstruct permanent stats inside a combat engine;
- overwrite curated Aemeath/Chisa/Verina combat logic;
- interpolate missing level/stat progression values;
- invent an Echo cost or a level mapping that the source has not confirmed.

## First safe mappings

The first implementation can map fields whose normalized semantics are already explicit:

### Characters

- Encore `sourceId` -> `externalIds.encore`;
- canonical ID -> stable deterministic ID derived from entity kind plus Encore ID, never display name;
- `name`;
- `element`;
- `weaponType`;
- `rarity`;
- skill source IDs/names/plain-text descriptions and source parameters;
- Resonance Chain 1..6 names/descriptions;
- source provenance SHA-256.

Character growth curves remain source-indexed until the meaning of every source index is mapped to an exact game level. No interpolation is allowed.

### Weapons

- Encore `sourceId` -> `externalIds.encore`;
- stable canonical ID;
- `name`, type, rarity;
- plain-text passive name/template and rank parameter sets;
- source growth values retained only when their level/index semantics are explicit;
- source provenance SHA-256.

Observed fractional weapon source indices such as 20.5/40.5/... remain source facts. They must not be rounded into `NumericStatProgressionPoint.level` without a reviewed level mapping.

### Echoes

- Encore `sourceId` -> `externalIds.encore`;
- stable canonical ID;
- `name`;
- plain-text Echo skill information;
- reviewed Sonata references;
- source provenance SHA-256.

`EchoCatalogEntry.cost` is mandatory in `GameDatabaseV1`; therefore an Echo must not be promoted into the canonical database until its 1/3/4 cost has a confirmed source mapping. Keeping an Echo in normalized-source quarantine is preferable to guessing.

### Sonata

- stable source/canonical IDs;
- reviewed piece thresholds;
- sanitized plain-text bonus descriptions;
- source provenance.

Unreliable lore/localization text remains outside the canonical database.

## Fail-closed generation

The generator should:

1. validate the normalized snapshot envelope/version;
2. rebuild every canonical object field-by-field;
3. reject duplicate source and canonical IDs;
4. reject unknown enum mappings;
5. reject unresolved mandatory fields instead of using placeholders;
6. validate all cross-references;
7. construct `GameDatabaseV1`;
8. run `createGameCatalog` and require `valid === true`;
9. write the generated artifact atomically;
10. produce a reviewable generation report listing imported, skipped-unresolved, and rejected entities.

The generated database is descriptive/catalog data. Combat execution remains a separately reviewed curated layer.
