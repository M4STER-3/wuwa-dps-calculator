# Encore Release live import security audit — 2026-08-17

## Scope

This audit covers the first real network execution of the hardened Encore RAW importer against the English `Release` dataset. It is a source-ingestion security review, not a claim that Encore or any third party is intrinsically trusted.

The one-time audit ran from an isolated GitHub branch with repository permissions limited to `contents: read`. The branch had no deployment credentials and was not intended for merge. Importer attack tests ran successfully before the live network step.

The live audit completed successfully and uploaded only the sanitized audit reports. RAW source payloads were not uploaded as workflow artifacts and were not promoted into `main`.

## Observed source volume

The audited Release response contained:

- 60 character entities;
- 120 weapon entities;
- 287 Echo entities;
- 16,821,795 remote bytes read by the importer;
- 930 observed schema paths;
- 606 observed scalar field-inventory paths.

The first audit had no previous RAW snapshot, so every source ID was reported as newly observed and no source-removal guard was triggered.

## Content-risk findings

The safe field inventory observed:

- 16,768 URL-like string values;
- 2,403 strings with HTML/rich-text-like markup;
- 0 script-like strings under the current detector;
- 0 strings containing disallowed control characters under the current detector.

These counts are important because they confirm that remote strings cannot be treated as presentation-ready trusted HTML even when the source is behaving normally.

### Embedded URLs

Encore payloads contain many URL-like values, largely associated with images and other source metadata. The game-data importer does not follow URLs discovered in payload values. Network destinations are constructed only by the reviewed Encore client from its fixed endpoint family.

Generated catalog data must not preserve arbitrary remote asset URLs as runtime browser dependencies. Image resolution remains the responsibility of the separately hardened asset registry.

### Rich-text / markup

A substantial number of source strings contain markup. No generated catalog component may render these strings through `innerHTML`, `dangerouslySetInnerHTML`, a DOM HTML parser, or equivalent executable markup path.

Normalizer output intended for user-visible text must use a reviewed plain-text conversion that:

- rejects script-like and event-handler-like input fail-closed;
- strips bounded formatting tags as formatting rather than executing them;
- removes disallowed control characters;
- applies field-specific maximum lengths;
- leaves the resulting string to React text-node escaping at render time.

The original source representation can remain in the quarantined RAW snapshot for provenance, but it is not browser-facing content.

### Source conditions and formula-like strings

Character skill payloads include structured damage data as well as source condition strings such as internal game-condition expressions. These are valuable evidence for later combat-data curation, but they are an additional execution boundary.

Source conditions, formulas, parameter expressions and similar fields are opaque data. They must never be passed to `eval`, `Function`, a shell, an expression interpreter, or automatically translated into `CombatEffect`/Damage Engine rules.

If combat support later uses information from these fields, that translation must happen in reviewed curated combat data with explicit tests.

## Data-quality findings relevant to normalization

The live field inventory confirms several useful source shapes:

### Characters

Confirmed source fields include:

- `Name.Content` for the display name;
- `ElementName` / `ElementId`;
- `WeaponTypeName` / `WeaponType`;
- `QualityId`;
- `MaxLevel`;
- `Skills[]` with `SkillName`, `SkillType`, `SkillDescribe`, source IDs and attribute/value arrays;
- `ResonantChain[]` with six indexed nodes, node names and descriptions;
- `SkillTree[]` permanent-property node titles/descriptions;
- `Properties[]` with names, base values and source growth points;
- structured `Skills[].DamageList[]` source damage evidence.

The source growth-point `level` field currently ranges from 1 to 48 in the audit. It must **not** be silently treated as character levels 1–90. Its semantics require a separate verified mapping before it can populate `NumericStatProgression.level`.

### Weapons

Confirmed fields include:

- `ItemId`;
- `WeaponName`;
- `WeaponTypeName` / `WeaponType`;
- `QualityId`;
- `AttributesDescription` / background description;
- passive name in `ResonName`;
- formatted passive description/template in `Desc` plus `DescParams`;
- `Properties[]` with base values and source growth values;
- breach/level-limit metadata through 90.

Weapon passive descriptions remain descriptive catalog data. They are not executable effects.

### Echoes and Sonata

Confirmed fields include:

- `MonsterId` / `MonsterName`;
- element data;
- source rarity/quality fields;
- Echo skill detail under `Skill`, including plain summary, formatted description, cooldown and structured damage evidence;
- `FetterGroupDetails` / `FetterDetails`, which expose Sonata names, descriptive text, set-effect descriptions and observed activation keys such as 2 and 5 pieces.

The audit also shows some duplicated/source-internal Sonata representation and occasional mixed-language source definition text. Normalization must select reviewed stable fields and deduplicate Sonata definitions rather than copying every repeated Echo-local representation.

Echo `Rarity`, `QualityId`, `LevelUpGroupId` and handbook intensity are source concepts that must not be guessed into player Echo cost/quality semantics without explicit validation.

## Threat assessment

### What the audit demonstrates

The current importer successfully handled the real Release source while enforcing the planned network, JSON, size, path and dangerous-key boundaries. No source content was executed and no external payload URL selected a second network destination.

The normal source itself contains enough URLs, markup and expression-like strings to justify those controls; removing them later would materially increase risk.

### Residual risks

The main remaining ingestion risks are:

1. **Source-schema drift** — fields can change type/meaning while still being valid JSON.
2. **Semantic poisoning** — a compromised source could provide plausible but wrong numeric/text values.
3. **Markup evolution** — new rich-text tags could appear and must remain inert.
4. **Resource amplification** — entity counts or description sizes could grow toward configured budgets.
5. **Mapping mistakes** — a developer could assign a source-internal index to the wrong game concept.
6. **Accidental runtime coupling** — future code could bypass the generated local database and fetch/render Encore directly.
7. **Combat-logic injection by interpretation** — source descriptions/conditions could be incorrectly auto-translated into executable effects.

## Required controls for the normalizer

The first normalizer must therefore:

- use an explicit allowlist of known source fields;
- rebuild normalized objects rather than spreading source objects;
- validate known enums such as element and weapon type;
- reject duplicate source IDs and conflicting Sonata definitions;
- convert browser-facing strings to bounded inert plain text;
- exclude arbitrary URLs, internal Unreal asset paths and unknown fields from normalized catalog output;
- preserve source hashes/provenance separately;
- keep ambiguous progression/cost mappings unsupported instead of guessing;
- keep source damage conditions/formulas out of executable combat runtime;
- produce deterministic output and diagnostics;
- fail closed when a previously confirmed required field changes shape.

## Conclusion

The importer is suitable to proceed to reviewed normalization under the controls above. The live audit did **not** reveal evidence of script payloads in the current Release sample, but it did prove that URLs, markup and expression-like source data are common enough that the trust boundary must remain permanent.

This review does not authorize unattended auto-merge or direct source-to-production updates. Generated data changes remain reviewable until the normalization, diff and regression layers are mature.
