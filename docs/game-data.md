# WuWa Game Database V1

## Purpose

The Game Database is a static, versioned catalog of Wuthering Waves entities. It is intentionally separate from executable combat data and from player builds.

The target flow is:

`external source -> raw snapshot -> normalize/validate -> generated Game Database -> curated combat overlays -> GameCatalog -> player build -> build/stat resolver -> combat engines`

The current V1 foundation only defines the normalized catalog schemas and the internal `GameCatalog` access layer. It does not yet import remote data and does not change the Character Box, `finalStats`, or any combat engine.

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

## Catalog validation

`createGameCatalog` builds indexes and reports diagnostics for structural problems instead of silently accepting them. V1 includes checks for:

- empty or duplicate canonical IDs;
- duplicate Encore IDs inside an entity family;
- Echo references to unknown Sonata sets;
- manifest counts that do not match generated arrays.

Future importer validation will add schema checks, known enum/stat validation, source-volume regression guards, asset association checks, and curated-data reference checks.

## Asset integration

Images remain owned by the separate asset pipeline documented in `docs/assets.md`.

The Game Database does not copy content-addressed SHA-256 image paths into every entity. Asset resolution will join through `externalIds.encore`:

`catalog entity -> Encore ID -> asset manifest entity -> logical asset role -> SHA-256 object`

This keeps catalog data independent from physical filenames and preserves the current duplicate-free asset store.

## Import safety boundary

The future Encore importer must be fail-closed and treat every remote byte as untrusted data.

Required rules:

- fetch only from the explicitly allowlisted Encore API origin;
- use HTTPS only;
- use the Release dataset only;
- reject redirects, URL credentials, custom ports, and unexpected origins;
- accept API responses only when the HTTP content type is JSON;
- cap response sizes while streaming, not only through `Content-Length`;
- enforce request timeouts;
- parse JSON as data only and never evaluate or execute source-provided strings;
- never install packages, browser extensions, binaries, scripts, HTML, advertisements, archives, or executables discovered in source payloads;
- never follow arbitrary URLs embedded in descriptive fields;
- bound collection sizes, nesting depth, and traversal work;
- validate recognized entity IDs, costs, weapon types, elements, stats, and references before generated data becomes authoritative;
- write snapshots/generated output atomically;
- keep the previous successful generated database when an import is incomplete or invalid;
- never automatically delete a previously known entity merely because it disappeared from one remote response;
- report source removals as warnings for explicit review;
- keep raw source snapshots separate from executable application code;
- never turn remote descriptions into executable combat logic.

The existing image synchronizer already implements many equivalent network/content protections for image acquisition. The data importer should share or extract the same trusted Encore client instead of introducing a weaker second network path.

## Planned import lifecycle

The intended command will eventually perform:

`fetch -> raw snapshot -> normalize -> validate -> deduplicate -> asset match -> generate -> diff report`

Fetch and normalization should also be runnable independently so normalizer development and tests do not repeatedly contact Encore.

Each imported entity should retain provider metadata, external ID, language, dataset, import time, source version when available, and a deterministic source hash. Same ID + same source hash means no semantic source change; same ID + changed hash is an update candidate; new ID is an addition; missing ID is a warning, not an automatic deletion.

## Combat boundary

This work does not change the existing anti-double-counting rule. `UserBuild.finalStats` remains the sole permanent-stat input consumed by combat engines.

A later Build/Stat Resolver may derive `finalStats` from character progression, weapon, five equipped Echoes, Sonata bonuses, and permanent nodes. Conditional or timed equipment effects must remain runtime effects handled by the existing effect/state layers.
