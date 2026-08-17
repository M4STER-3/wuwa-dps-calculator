# GameDatabase readiness boundary

This stage answers one question before canonical generation: which normalized Encore facts can enter `GameDatabaseV1` without inventing semantics?

It intentionally does **not** generate the canonical database yet.

## Input and output

`npm run game-data:readiness` reads only the fixed local path:

`.tmp/wuwa-game-data-normalized/normalized-source.json`

and writes only:

`.tmp/wuwa-game-data-readiness/readiness.json`

The command accepts no paths, URLs, network options, or other arguments. The normalized input is treated as untrusted despite having already passed the importer/normalizer boundary. File size, JSON structure, dangerous keys, source IDs, source hashes, enums, counts, growth indexes, and symlink paths are checked again.

## What readiness means

The report separates source facts from canonical readiness.

### Characters

Source identity is ready when the Encore ID, SHA-256 provenance, name, element, weapon type, rarity, skills, and complete Resonance Chain pass validation.

Two things remain deliberately separate:

- source growth indexes are not treated as game levels, so character stat progression is blocked while those semantics remain unresolved;
- a source skill without a display name remains unnamed. `SkillCatalogEntry.name` must never be filled with a guessed value.

### Weapons

Source identity/name/type/rarity and SHA-256 provenance can be validated. Source growth points are retained as facts, including the reviewed half indexes `20.5`, `40.5`, `50.5`, `60.5`, `70.5`, and `80.5`.

Those indexes are not converted into `NumericStatProgressionPoint.level` until an explicit game-level mapping is reviewed.

### Echoes

Echo source identities and source Sonata group references can be validated, but `GameDatabaseV1` requires `cost: 1 | 3 | 4`.

Until a reviewed mapping supplies that cost for every Echo, the readiness report keeps canonical Echo promotion at zero rather than deriving cost from rarity, quality, intensity, or another similarly named field.

### Sonata sets

The normalized source currently merges Sonata effect definitions by display name. Their effect definitions can be reviewed, but display names are not accepted as canonical identity.

Canonical Sonata promotion remains blocked until the Encore group IDs are mapped to stable Sonata identities. Echo-to-Sonata canonical references remain blocked for the same reason.

## Security and architecture boundary

The readiness stage must never:

- read RAW Encore files directly;
- fetch network resources;
- evaluate source formulas, conditions, HTML, URLs, or descriptions;
- interpolate missing values;
- invent display names, Echo costs, game levels, or Sonata IDs;
- modify `UserBuild.finalStats`;
- modify Damage/State/Temporal engines;
- replace curated character combat logic.

A future generator may consume only facts marked ready here, rebuild `GameDatabaseV1` field-by-field, validate all references and counts, and require `createGameCatalog(...).valid === true` before writing a generated database artifact.
