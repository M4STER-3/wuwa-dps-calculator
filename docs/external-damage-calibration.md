# External damage calibration

## Contract and provenance

External fixtures are static, versioned records in `src/data/aemeath-external-benchmarks.ts`; tests never contact a calculator. Each record owns the complete panel, target, equipment/effect state, talent level, expected Normal/Average/Crit display, optional displayed hits, source/date, confidence, and display convention. WutheringTools is a high-confidence independent benchmark, not an infallible formula authority.

**Damage accuracy** holds stats, action, enemy and buffs constant. **Rotation DPS accuracy** additionally requires the same ordered actions, state at each action, cancels, and duration. A damage match cannot validate animation time, and a DPS mismatch must not be “fixed” by changing a damage formula.

## Naked Aemeath S0 Lv90

The reference has 425 ATK, 11025 HP, 1148 displayed DEF, 5% CR, 150% CD, 100% ER, 10% TBB, no weapon, Echo, Sonata, runtime effect or damage bonus. The target is Lv90 with 10% Fusion/Physical RES and Tune class 4C. All talents are 10.

The 24 currently calculable Standard actions match the external displayed Normal, Average and Crit integers exactly: Basic 1–4, Heavy I/II, Mid-air, Dodge, both Sync Strikes, Mech Basic 1–4, Mech Heavy I/II, Mech Mid-air, Mech Dodge, Overdrive, Finale, both Seraphic Duets, and both Intros. No Motion Value was changed. Every externally exposed hit was also transcribed: raw engine hit-group subtotals sum to the raw action total, while independently ceiling-displayed hits need not sum to the independently displayed total.

## Display semantics and Tune precision

The observed WutheringTools convention is ceiling at the final presentation boundary. `compareExternalDisplay` makes that convention explicit but is not called by the Damage Engine or React. Calculations remain full precision without intermediate rounding.

For naked Lv90 4C Tune Break, the current verified formula gives `79623.37519788918`, displayed as `79624` under that convention, versus external `79625`. Thus final display rounding alone does **not** explain the difference. A hidden decimal in the enemy base, an external intermediate convention, or another formula detail could account for it, but none is independently verified. The `10027` 4C constant and formula remain unchanged; the fixture is qualified and permits two displayed points (the actual displayed delta is one). Starburst (`29682`) and Seraphic Duet Bonus Tune damage (`5442`) match independently.

## Real-build findings

The recommended/signature preset is an integration scenario, not promoted to an external benchmark: its final stats intentionally use exact lower bounds of community target ranges rather than a uniquely verified real account. Tests nevertheless prove independently that permanent panel effects are audit-only, while manual Everbright applies Liberation DEF/RES Ignore, Trailblazing 5pc adds CR/Fusion damage, and Before All Sounds adds Heavy amplification. No temporal activation is claimed for these manual conditions.

## Talent-level readiness

The data contract is currently `level10Only`. Exact Lv1–9 tables are absent and must never be interpolated.

| Action family | Lv10 | Lv1–9 |
| --- | --- | --- |
| Basic / Heavy / Mid-air / Dodge | verified | unavailable |
| Sync Strikes and Mech attacks | verified | unavailable |
| Resonance Liberation (Overdrive/Finale) | verified | unavailable |
| Forte (Seraphic actions and Tune responses) | verified | unavailable |
| Intro normal/mech | verified | unavailable |
| Form switch (no damage MV) | verified declarative action | unavailable |

Future ingestion must add exact level-owned values before a level becomes supported.

## Rotation confidence

The existing 11.69s reference remains a Prydwen community calculation and the individual durations remain estimated-calibrated. Its duration confidence is therefore lower and categorically separate from external single-action damage confidence. A rotation comparison must always report **total calculated damage**, **rotation duration**, and **DPS** separately, together with the precise action/state list. Unknown hit/cancel timing is not inferred from displayed damage.

## Future mechanic-coverage profile

Aemeath is the calibration reference, **not** the template all future Resonators must resemble. Selection should maximize mechanics newly exercised by verified fixtures.

| Mechanic | Aemeath coverage | Future priority |
| --- | --- | --- |
| ATK scaling | calibrated | low |
| HP scaling / DEF scaling | absent / absent | high |
| Runtime stat dependencies | effect-engine integration | medium |
| Resource transactions | declared, incomplete execution | high |
| Forms / action replacement / damage-type replacement | forms and conditional type represented | medium |
| Target statuses / DoT / stack lifecycle | trails declared; damage/timing unverified | high |
| Coordinated attacks / follow-ups / summons | Tune response partial; Echo summon separate | high |
| Snapshots | engine capability, no Aemeath external fixture | high |
| Shields / heals | S5 description only / absent | high |
| HP thresholds / resource thresholds | resource requirements declared | high |
| Multi-hit damage / timing dependencies | damage distribution calibrated; timing unknown | high for timing |
| Cooldown / charge mechanics | cooldowns declared, no charge benchmark | medium |
| Special damage families | Tune calibrated; Fusion Burst unsupported | high |
| Tune / Fusion mechanics | Tune qualified; no invented Fusion formula | high for Fusion |

Future candidates should intentionally cover HP/DEF scalers, DoT/status cadence, coordinated/summoned damage, snapshot behavior, sustain, thresholds, charges, and other gaps rather than duplicating Aemeath's ATK/Tune profile.
