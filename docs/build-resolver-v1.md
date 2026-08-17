# Build Resolver V1

`src/game-data/build-resolver.ts` connects reviewed `GameDatabaseV1` catalog data to an exact permanent stat sheet without moving combat logic into the data layer.

## Covered sources

V1 resolves these sources exactly once:

- character HP / ATK / DEF from the exact non-interpolated level/ascension progression;
- weapon base ATK from the exact non-interpolated progression;
- weapon secondary stat when its semantic is reviewed (`ATK`, `HP`, `DEF`, `Crit. Rate`, `Crit. DMG`, `Energy Regen`);
- five-star +25 Echo main stats;
- five-star +25 Echo substats.

The universal baseline used for the panel is 5 Crit Rate, 150 Crit DMG and 100 Energy Regen, expressed in percentage points. These values were cross-checked against current WuWa character records before V1 was added.

## Fail-closed rules

The resolver rejects unknown IDs, weapon/character type mismatches, missing exact progression points, ambiguous ascension-cap rows without an explicit pre/post choice, unsupported weapon secondary semantics and any invalid Echo loadout rejected by `resolveEchoLoadoutV1`.

No interpolation is performed.

## Anti-double-counting boundary

The resolver does **not** automatically mutate `UserBuild.finalStats`.

`statSheet` is the exact result for the permanent sources listed above. `complete` remains false while permanent sources that are not yet safely structured remain unresolved. V1 reports those sources explicitly:

- character permanent nodes / Minor Fortes;
- weapon passive effects;
- active Sonata bonuses.

Remote descriptions are never parsed or executed to fill those gaps. A future integration may write a resolved sheet into `UserBuild.finalStats` only after every permanent source for that build has a reviewed structured representation, or through an explicit input contract that proves the unresolved sources are already accounted for exactly once.

The Damage, Temporal and State engines continue to consume `finalStats` only and never reconstruct equipment stats themselves.
