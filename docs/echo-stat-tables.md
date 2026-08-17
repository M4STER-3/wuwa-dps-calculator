# Echo stat tables and loadout V1

## Scope

The generated Encore catalog owns Echo identity, cost, Sonata compatibility and source provenance. Encore does not expose the complete Echo main-stat/substat roll tables used by the calculator, so those values are maintained as a separate curated, multi-source overlay.

V1 deliberately supports only **five-star Echoes at +25** for main stats and the exact reviewed five-star substat roll values. No +1..+24 value is interpolated.

## Reviewed sources

The table was reviewed on 2026-08-17 against:

- Wuthering Waves Wiki, Echo/Stats — exact five-star +25 main-stat maxima and detailed substat roll values;
- WutheringWaves.gg, Echo System Guide — cross-check of main-stat families and the fixed secondary-stat family by Echo cost;
- Prydwen Echo Stats — corroboration of substat ranges and the no-duplicate-substat rule on a single Echo.

Source names are retained in `reviewedEchoStatTableV1`. The table is not attributed to Encore.

## Stat semantics

Each Echo stat carries an explicit application mode:

- `flat`: add an absolute HP/ATK/DEF amount;
- `base-percent`: percentage of the relevant base HP/ATK/DEF;
- `percentage-point`: add directly to a percentage-valued `FinalStats` field such as Crit Rate, Crit DMG, Energy Regen, elemental DMG bonus, or a damage-type bonus.

This prevents a value such as `100 ATK` from being confused with `30% ATK`.

The fixed secondary main stat is modeled separately from the random primary main stat:

- 1-cost: +2280 flat HP at +25;
- 3-cost: +100 flat ATK at +25;
- 4-cost: +150 flat ATK at +25.

## Loadout resolver

`resolveEchoLoadoutV1()` validates and aggregates an equipped Echo set without writing `UserBuild.finalStats`.

V1 validates:

- at most five equipped Echoes;
- five-star rarity and +25 only;
- total Echo cost at most 12;
- Echo IDs must exist in the supplied GameDatabase;
- selected Sonata must be one of that Echo's generated Sonata possibilities;
- primary main stat must be valid for the Echo's cost;
- every substat roll must exactly match a reviewed five-star roll value;
- at most five substats per Echo;
- a stat cannot appear twice on the same Echo;
- the active `mainEchoId`, when supplied, must be one of the equipped Echoes.

V1 also requires unique Echo types in a loadout. This is intentionally conservative so Sonata counting cannot accidentally credit duplicate copies. Support for duplicate/shiny-copy nuances can be added only after their set-count behavior is represented explicitly.

The resolver returns:

- total cost;
- selected main Echo;
- Sonata piece counts;
- flat HP/ATK/DEF contributions;
- base-percent HP/ATK/DEF contributions;
- percentage-point Crit/ER/healing/elemental/damage-type contributions.

## Why it does not write `finalStats` yet

Existing builds may already contain Echo/weapon/Sonata effects inside their manually authored `finalStats`. Adding resolved Echo values directly to those builds would double count equipment.

The next Build/Stat Resolver stage must have an explicit resolved-build mode. It will calculate permanent stats from known base character/weapon values and reviewed equipment inputs, then emit `finalStats` once. Legacy/manual builds remain authoritative and unchanged.

Percent HP/ATK/DEF also require exact base character/weapon stats at the selected level. Until the source growth-index mapping is reviewed, the Echo resolver intentionally returns those percentages as structured contributions instead of fabricating an absolute result.

## Combat boundary

The Echo loadout resolver handles permanent numeric equipment contributions only. It does not parse Sonata descriptions or Echo-skill descriptions into executable rules. Main Echo combat behavior and conditional/timed Sonata effects remain separate curated combat-effect work.
