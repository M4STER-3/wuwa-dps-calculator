# WuWa Game Database V1

## Purpose

The Game Database is a static, versioned catalog of Wuthering Waves entities. It is intentionally separate from executable combat data and from player builds.

The target flow is:

`external source -> raw snapshot -> normalize/validate -> generated Game Database -> curated combat overlays -> GameCatalog -> player build -> build/stat resolver -> combat engines`

The V1 foundation defines the normalized catalog schemas and the internal `GameCatalog` access layer. A fail-closed Encore RAW importer is also available and documented in [`game-data-import.md`](game-data-import.md). The importer does not change the Character Box, `finalStats`, or any combat engine.

## Identity model

Every catalog entity has a canonical calculator ID plus explicit external IDs.

- The canonical `id` belongs to this project and must never be derived at runtime from a localized display name.
- `externalIds.encore` is the stable join key used for Encore imports and for the existing WuWa asset manifest.
- `externalIds.wuwa` may store a game-owned identifier when known independently of the provider.

Display names are never primary keys.

## Generated vs curated data

Generated data is source-derived and must not be edited manually. Curated data is maintained separately and may contain reviewed combat rules, corrections, measurements, or other information that cannot be safely inferred from descriptive source text.

A character may therefore exist completely in the Game Database while having no executable `ResonatorCombatData` yet.

Descriptions from Encore or another source must never be parsed into executable combat rules automatically.

## Exactness rules

Stat progression stores exact known source points and declares `interpolation: "none"`.

Missing levels or ranks must remain unsupported until an exact formula or exact source value is available. Consumers must not silently interpolate, average, extrapolate, or invent values.

Echo definitions and Echo stat tables are separate concepts. Repeated game-wide roll tables must not be duplicated into every Echo entry.

Sonata thresholds are modeled as arbitrary piece-count bonuses instead of hard-coding only 2-piece and 5-piece sets.

### Reviewed character and weapon level mapping

A live Release audit on 2026-08-17 established one exact 96-point growth signature across all 60 imported characters and one exact 96-point signature across all 120 imported weapons. The mapping is enforced as a source contract rather than inferred dynamically.

For characters, levels 1 through 90 are explicit. The ascension boundaries at levels 20, 40, 50, 60, 70 and 80 each contain two source rows: the first is the pre-ascension value and the second is the post-ascension value. Character `growthId` is required to advance exactly from 1 through 96. Generated points retain the displayed game level and use `ascended: false` / `ascended: true` only at those duplicated boundaries.

For weapons, the same post-ascension states are encoded by Encore as source levels `20.5`, `40.5`, `50.5`, `60.5`, `70.5` and `80.5`. These six half-step source values are mapped to displayed levels 20/40/50/60/70/80 with `ascended: true`; the matching integer boundary is `ascended: false`. No other fractional source level is accepted.

Character HP/ATK/DEF source values remain exact numbers, including fractional values that the game UI may display rounded. Weapon base ATK decimal strings are converted to exact numbers. Weapon secondary-stat strings must be exact percentages and are stored as numeric percentage points with `unit: "percentage-points"`.

Any missing/extra point, changed level order, unexpected half-step, incorrect character `growthId`, non-numeric character base stat, or malformed weapon percentage fails the reviewed generator. Technical fixtures without populated progressions may remain explicitly unresolved, but a partially populated production family is rejected.

## Catalog validation

`createGameCatalog` builds indexes and reports diagnostics for structural problems instead of silently accepting them. V1 includes checks for:

- empty or duplicate canonical IDs;
- duplicate Encore IDs inside an entity family;
- Echo references to unknown Sonata sets;
- manifest counts that do not match generated arrays.

The RAW importer separately validates its network/source boundary: exact endpoint families, Release-only requests, JSON content type, response/total byte budgets, UTF-8/JSON structure, dangerous object keys, bounded IDs, duplicate source IDs, source removals, path containment and staged promotion.

Normalized-data validation adds reviewed enum/stat validation, stable IDs, source hashes, Echo classification/cost mapping, Sonata references and the exact character/weapon progression signatures before generated promotion.

## Asset integration

Images remain owned by the separate asset pipeline documented in `docs/assets.md`.

The Game Database does not copy content-addressed SHA-256 image paths into every entity. Asset resolution will join through `externalIds.encore`:

`catalog entity -> Encore ID -> asset manifest entity -> logical asset role -> SHA-256 object`

This keeps catalog data independent from physical filenames and preserves the current duplicate-free asset store.

## Import safety boundary

The Encore importer is fail-closed and treats every remote byte as untrusted data.

Current rules include:

- fetch only from the explicitly allowlisted Encore API origin and character/weapon/Echo endpoint families;
- use HTTPS only and the Release dataset only;
- reject redirects, URL credentials, custom ports, fragments and unexpected query parameters;
- accept API responses only when the HTTP content type is JSON;
- cap response sizes and total transfer while streaming, not only through `Content-Length`;
- enforce request timeouts;
- require valid UTF-8 and valid JSON;
- reject dangerous object keys such as `__proto__`, `prototype` and `constructor`;
- bound collection sizes, strings, nesting depth and traversal work;
- parse JSON as data only and never evaluate or execute source-provided strings;
- never install packages, browser extensions, binaries, scripts, HTML, advertisements, archives or executables discovered in source payloads;
- never follow arbitrary URLs embedded in descriptive fields;
- never allow remote source IDs to choose filesystem paths;
- stage complete RAW acquisition in an ignored quarantine directory before promotion;
- keep the previous successful RAW snapshot when an import is incomplete or invalid;
- block promotion if a previously known entity disappears from a remote response;
- never turn remote descriptions into executable combat logic.

The existing image synchronizer uses equivalent defensive principles for image acquisition. Both data and asset pipelines keep their network/content boundaries isolated from the runtime application.

## Import lifecycle

The reviewed path is:

`fetch list/detail -> quarantine -> network/JSON validation -> RAW manifest + source hashes -> normalize/harden -> Echo classification -> readiness -> generated Game Database -> independent verification -> promotion branch -> PR`

Each RAW entity retains a source ID, deterministic source hash, byte size and trusted request URL through the snapshot manifest. Same ID + same detail hash means no source change; same ID + changed detail hash is an update candidate; new ID is an addition; a missing ID blocks automatic promotion.

The durable browser snapshot lives at `public/data/wuwa/game-database-v1.json`. The promotion workflow separates the network job from the repository-write job: only the independently verified sanitized database crosses that boundary; RAW and normalized snapshots do not.

## Combat boundary

This work does not change the existing anti-double-counting rule. `UserBuild.finalStats` remains the sole permanent-stat input consumed by combat engines.

A Build/Stat Resolver may derive `finalStats` from exact character progression, exact weapon stats, five equipped Echoes, Sonata bonuses, and reviewed permanent nodes. Conditional or timed equipment effects must remain runtime effects handled by the existing effect/state layers. No combat engine may independently rebuild permanent stats from equipment.
