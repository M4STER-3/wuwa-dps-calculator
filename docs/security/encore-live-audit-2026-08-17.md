# Encore Release live import security audit — 2026-08-17

## Scope

This audit covers the first real network execution of the hardened Encore RAW importer against the English `Release` dataset and the subsequent reviewed source-normalization validation. It is a source-ingestion security review, not a claim that Encore or any third party is intrinsically trusted.

The live audit runs used isolated GitHub branches with repository permissions limited to `contents: read`. They had no deployment credentials and were not intended for merge. Importer and normalizer attack tests ran before live network normalization.

RAW source payloads were never uploaded as workflow artifacts. Only bounded audit reports or the already-normalized inert preview were uploaded for short-lived inspection.

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

### Risky content is not the same as detected malicious content

The audited Release sample did **not** contain a confirmed malicious payload under the current detectors. No script-like source string was detected, no disallowed control-character string was detected, no source value caused the importer to follow an external URL, and no source content was executed.

The URL-like, rich-text and expression-like values above are therefore classified as **attack surface / latent risk**, not evidence that Encore was attacking the importer. They become dangerous only if future code incorrectly treats them as executable markup, trusted navigation targets or executable expressions. The security boundary exists so that a future compromised or malformed source still fails closed rather than turning that risk into execution.

### Embedded URLs

Encore payloads contain many URL-like values, largely associated with images and other source metadata. The game-data importer does not follow URLs discovered in payload values. Network destinations are constructed only by the reviewed Encore client from its fixed endpoint family.

Generated catalog data must not preserve arbitrary remote asset URLs as runtime browser dependencies. Image resolution remains the responsibility of the separately hardened asset registry.

### Rich-text / markup

A substantial number of source strings contain markup. No generated catalog component may render these strings through `innerHTML`, `dangerouslySetInnerHTML`, a DOM HTML parser, or equivalent executable markup path.

Normalizer output intended for user-visible text uses a reviewed plain-text boundary that:

- rejects script-like and event-handler-like input fail-closed;
- strips bounded formatting tags as formatting rather than executing them;
- removes disallowed control characters;
- applies field-specific maximum lengths;
- leaves the resulting string to React text-node escaping at render time.

The original source representation can remain in the quarantined RAW snapshot for provenance, but it is not browser-facing content.

### Source conditions and formula-like strings

Character skill payloads include structured damage data as well as source condition strings and formula-like/internal game expressions. These are valuable evidence for later combat-data curation, but they are a separate execution boundary.

Source conditions, formulas, parameter expressions and similar fields are opaque data. They must never be passed to `eval`, `Function`, a shell, an expression interpreter, or automatically translated into `CombatEffect`/Damage Engine rules.

If combat support later uses information from these fields, that translation must happen in reviewed curated combat data with explicit tests.

## Data-quality findings relevant to normalization

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

Character growth-point indexes observed in the reviewed source remain source metadata. They are not silently interpreted as game levels.

The live normalizer also found six legitimate character skill entries whose source display name is empty while a type and description are present:

- character `1305`, skill `1002308`;
- character `1410`, skill `1003808`;
- character `1412`, skill `1005108`;
- character `1604`, skill `1001708`;
- character `1605`, skill `1001708`;
- character `1607`, skill `1003108`.

The normalized source layer preserves their source ID, type and reviewed descriptive content without inventing a display name. A diagnostic records the condition so the future canonical generator must classify these entries explicitly.

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

The live source contains 23,040 weapon property growth points. Of these, 1,440 use reviewed half-step source indexes across all 120 weapons:

- `20.5`: 240 occurrences;
- `40.5`: 240 occurrences;
- `50.5`: 240 occurrences;
- `60.5`: 240 occurrences;
- `70.5`: 240 occurrences;
- `80.5`: 240 occurrences.

These values are preserved exactly as `sourceLevelIndex`; they are **not** rounded, interpolated or asserted to represent game levels/ascension semantics. The normalizer only accepts the six half-step values confirmed by the live audit. A new fractional convention such as `21.25` fails closed until reviewed.

Weapon passive descriptions remain descriptive catalog data. They are not executable effects.

### Echoes and Sonata

Confirmed fields include:

- `MonsterId` / `MonsterName`;
- element data;
- source rarity/quality fields;
- Echo skill detail under `Skill`, including plain summary, formatted description, cooldown and structured damage evidence;
- `FetterGroupDetails` / `FetterDetails`, which expose Sonata names, descriptive text, set-effect descriptions and observed activation keys such as 2 and 5 pieces.

The audit shows duplicated/source-internal Sonata representation and occasional mixed-language definition text. Normalization selects reviewed stable fields and deduplicates Sonata definitions rather than copying every repeated Echo-local representation. Echo-local Sonata definition lore remains RAW-only in the normalized preview.

Echo `Rarity`, `QualityId`, `LevelUpGroupId` and handbook intensity are source concepts that must not be guessed into player Echo cost/quality semantics without explicit validation.

## Successful live normalizer validation

After two intentional fail-closed runs exposed legitimate source-shape differences (an unnamed skill and fractional weapon growth indexes), the third live validation completed successfully end to end against the real Release source.

The resulting source-normalized preview contained:

- 60 characters;
- 120 weapons;
- 287 Echoes;
- 34 deduplicated Sonata sets;
- 9,525,520 bytes of normalized JSON.

The normalizer now imposes a 32 MiB total output ceiling before its atomic write. The observed live output is well below that bound while leaving room for normal source growth.

The live workflow then scanned the completed normalized output and rejected the run if it contained an HTTP(S) URL, script-like token, generic markup tag, event-handler-like token or the internal missing-skill-name sentinel. The scan passed.

A separate inspection of the downloaded normalized artifact confirmed:

- no duplicate character, weapon or Echo source IDs;
- no duplicate Sonata names;
- SHA-256 provenance entries for all 60 characters, 120 weapons and 287 Echoes, all formatted as 64 lowercase hexadecimal characters;
- no HTTP(S) URLs;
- no remaining markup/script-like tokens detected by the audit patterns;
- no dangerous object keys such as `__proto__`, `prototype` or `constructor`;
- no propagated `DamageList`, `Condition`, `Formula`, `Advertisement` or equivalent reviewed-for-exclusion keys;
- no leaked internal missing-name sentinel;
- zero Sonata `sourceLore` fields;
- all 1,440 reviewed fractional weapon indexes restored exactly to the six observed half-step values;
- six unnamed source skills preserved without fabricated names;
- the longest normalized string observed was 6,791 characters, below the 20,000-character display-text limit.

The live preview remains a source-normalized intermediate representation. It is not yet the canonical `GameDatabaseV1` and is not automatically consumed by the browser or combat engines.

## Supply-chain observation during the live runs

The locked npm installation emitted deprecation warnings for transitive packages including `glob@9.3.5`. This warning is a maintenance signal, not evidence that the Encore payload exploited a dependency. During the same runs, `npm audit` reported 0 known vulnerabilities, registry-signature verification passed for 692 packages, and provenance attestations were verified for 185 packages.

This dependency warning remains worth monitoring and will be revisited in the final project-wide security review rather than being treated as an Encore-source finding.

## Threat assessment

### What the audit demonstrates

The current importer and source normalizer successfully handled the real Release source while enforcing network, JSON, size, path, provenance, content and dangerous-key boundaries. No source content was executed and no external payload URL selected a second network destination.

The normal source itself contains enough URLs, markup and expression-like strings to justify those controls; removing them later would materially increase risk.

The two failed live normalization attempts were data-schema/semantic mismatches, not attacks. Their failure before output publication demonstrated that unexpected source shapes stop the pipeline rather than being silently coerced.

### Residual risks

The main remaining ingestion risks are:

1. **Source-schema drift** — fields can change type/meaning while still being valid JSON.
2. **Semantic poisoning** — a compromised source could provide plausible but wrong numeric/text values.
3. **Markup evolution** — new rich-text tags could appear and must remain inert.
4. **Resource amplification** — entity counts or description sizes could grow toward configured budgets.
5. **Mapping mistakes** — a developer could assign a source-internal index to the wrong game concept.
6. **Accidental runtime coupling** — future code could bypass the generated local database and fetch/render Encore directly.
7. **Combat-logic injection by interpretation** — source descriptions/conditions could be incorrectly auto-translated into executable effects.
8. **Supply-chain drift** — transitive packages or GitHub Actions can change risk independently of Encore data.

## Required controls going forward

The normalizer and future canonical generator must continue to:

- use explicit allowlists of known source fields;
- rebuild normalized objects rather than spreading source objects;
- validate known enums such as element and weapon type;
- reject duplicate source IDs and conflicting Sonata definitions;
- convert browser-facing strings to bounded inert plain text;
- exclude arbitrary URLs, internal asset paths and unknown fields from generated catalog output;
- preserve source hashes/provenance separately for every character, weapon and Echo source entity;
- keep ambiguous progression/cost mappings unsupported instead of guessing;
- keep source damage conditions/formulas out of executable combat runtime;
- produce deterministic output and diagnostics;
- fail closed when a previously confirmed required field changes shape;
- retain bounded total output size and atomic writes;
- keep the browser disconnected from Encore and resolve images only through the hardened local asset registry.

## Conclusion

The live audit did **not** reveal evidence of a script payload, malware or another confirmed malicious Encore payload in the current Release sample. It did prove that URLs, markup and expression-like source data are common enough that the trust boundary must remain permanent.

The importer and reviewed source normalizer are suitable to proceed to the canonical Game Database generator under the controls above. This review does not authorize unattended auto-merge or direct source-to-production updates.

A separate, broader security review is still required after the canonical generator, diff/regression layer and asset-registry integration are complete.