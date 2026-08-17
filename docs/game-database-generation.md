# Generated GameDatabase V1

This stage converts the reviewed Encore Release source snapshot into the calculator's static `GameDatabaseV1` catalog.

## Pipeline

```text
Encore Release
  -> validated RAW snapshot
  -> reviewed source normalizer
  -> normalized-source hardening
  -> reviewed Echo catalog classification
  -> readiness report
  -> GameDatabaseV1 generator
  -> createGameCatalog validation
```

The generator is offline and fixed-path. It does not fetch network resources and it does not execute source text.

## Echo catalog classification

The RAW Encore Echo resource contains more than directly selectable base Echo entries. The reviewed classifier keeps every source row in the normalized snapshot, but only promotes rows that match the reviewed base boundary:

- `PhantomType === 1`;
- `QualityId === 5`;
- display name is not a `Phantom: ...` skin row;
- `MainProp.RandGroupId` is one of the reviewed base groups `501`, `502`, or `503`.

Base Echo cost is derived only from the reviewed source property group mapping:

- `501 -> cost 4`;
- `502 -> cost 3`;
- `503 -> cost 1`.

The classifier also cross-checks normalized Quality/Rarity/LevelUp/Sonata references against the exact SHA-256-verified RAW detail before assigning catalog state or cost. Unknown base RandGroup values fail closed.

`Phantom: ...` skin rows are marked `phantom-skin`. Other source rows are marked `noncanonical`. They remain available as source evidence but are not automatically emitted as selectable `EchoDefinition` entries.

## Canonical IDs and provenance

Generated entity IDs are calculator-owned and deterministic. Display names are never identity.

Every generated character, weapon, Echo and Sonata definition retains reviewed Encore provenance with:

- Encore external ID;
- language and Release dataset;
- import timestamp;
- SHA-256 source hash.

Sonata identity uses the reviewed numeric Encore `FetterGroupDetails.Group.Id`, not localized names. Sonata source hashes are deterministically derived from the normalized definition plus the sorted hashes of the contributing Echo source payloads.

## Deliberately omitted data

Generation does not invent information that has not been mapped exactly.

Currently omitted from generated runtime stats:

- character level/stat growth curves whose source indexes are not yet proven game-level mappings;
- weapon level/stat growth curves, including the reviewed half-step source indexes;
- weapon passive rank rendering when placeholder substitution is not yet reviewed;
- source character skill entries that genuinely have no display name;
- permanent character nodes as executable stat/combat effects.

Those facts remain in RAW/normalized data for later reviewed mapping.

## Combat boundary

The generated database is descriptive/static catalog data. It does **not** make remote descriptions executable combat logic.

Echoes become selectable catalog entities here, with stable IDs, cost, Sonata references and descriptive Echo-skill data. Making an equipped Echo affect a character's final DPS still belongs to the Build/Stat Resolver and combat-effect layers. `UserBuild.finalStats` remains the sole permanent-stat input consumed by the combat engines.

## Validation

Security tests cover malformed IDs, source-hash mismatches, unknown Sonata references, script-like/URL-bearing text, symlink/path attacks, unreviewed Echo groups, rarity contradictions, duplicate base Echo ItemIds and partial classification.

A TypeScript contract test passes the generated fixture database through `createGameCatalog`; generated output is not considered valid merely because it serializes successfully.
