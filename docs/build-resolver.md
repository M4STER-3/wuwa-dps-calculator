# Build Resolver V1

## Purpose

`resolveExactBuildStatSheetV1` is the upstream permanent-stat boundary between reviewed catalog/equipment data and `UserBuild.finalStats`.

It combines only sources that are already represented structurally and with exact units:

- character HP / ATK / DEF at an exact reviewed level and ascension state;
- weapon base ATK at an exact reviewed level and ascension state;
- weapon secondary stat when its semantic is explicitly allowlisted;
- five-star level +25 Echo main stats;
- exact reviewed Echo substat rolls.

It calls the strict Echo loadout resolver, so invalid Echo cost, Sonata compatibility, main-stat families, duplicated Echo types, duplicated substats and impossible roll values fail closed.

## Permanent stat formula boundary

For the covered sources, V1 uses the game-stat structure explicitly rather than adding already-final values together:

- `HP = character base HP * (1 + HP% / 100) + flat HP`
- `ATK = (character base ATK + weapon base ATK) * (1 + ATK% / 100) + flat ATK`
- `DEF = character base DEF * (1 + DEF% / 100) + flat DEF`

Crit Rate, Crit DMG, Energy Regen, Healing Bonus, elemental damage bonuses and reviewed damage-type bonuses are expressed as percentage points and added in that unit.

The resolver never interpolates character or weapon progressions. At level 20/40/50/60/70/80, where the catalog contains both pre- and post-ascension values, callers must provide the exact ascension side.

## Anti-double-counting rule

The resolver does **not** add its output on top of an existing manually entered `UserBuild.finalStats` object.

`UserBuild.finalStats` remains the sole permanent-stat source consumed by combat engines. A future Character Box migration may choose between a manual-stat build and an equipment-resolved build, but the combat engines must still receive exactly one final permanent stat sheet.

V1 therefore returns a `statSheet` plus `complete` and `unresolvedPermanentSources`. It must not automatically replace persisted `finalStats` while `complete === false`.

## Intentionally unresolved in V1

The following sources are still reported rather than interpreted from prose:

- permanent character/Forte stat nodes that the generated database does not yet expose structurally;
- weapon passive effects that are still descriptive/unrendered rather than reviewed structured ranks;
- active Sonata thresholds, whose descriptions are inert data and are never parsed into executable stat logic.

Conditional/timed Sonata, weapon, Main Echo or character effects do not belong in permanent `finalStats` even after they are structured. They belong to the existing runtime effect/state/temporal layers.

## Security and data-quality behavior

The resolver fails closed on:

- unknown character or weapon IDs;
- duplicate character/weapon catalog IDs;
- weapon type mismatch;
- missing or interpolating stat progression;
- ambiguous ascension-cap value without an explicit pre/post choice;
- unsupported weapon secondary-stat semantics or units;
- non-finite or negative resolved values;
- any invalid Echo loadout rejected by `resolveEchoLoadoutV1`.

No source description, HTML, URL, formula, condition or `DamageList` string is evaluated by this layer.
