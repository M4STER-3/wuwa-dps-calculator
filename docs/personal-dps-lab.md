# Personal DPS Lab

`/personal-dps` consumes the locally persisted Character Box; it does not persist its sandbox. **Action Lab** calls the Damage and Effect engines for one data-owned action. **Rotation Lab** calls `simulatePersonalCombat` with an existing temporal rotation. React renders domain view-models and contains no WuWa damage formula.

## Controls and honesty

- Build stats may be changed locally and reset from the saved build.
- The visible technical target resets to Lv90, 10% elemental/Physical RES and Tune 4C. It is not presented as an official enemy.
- Manual Effect Override is Action Lab debugging only. Permanent `already-in-final-stats` rules are visible and disabled, preventing Everbright, Sigillum and Trailblazing 2pc double counting.
- Observed Damage only compares calculated and observed numbers. Copy Validation Snapshot exports the selected build/action/target, overrides, result and diagnostics—not localStorage.
- COMPLETE means no relevant unsupported or missing-context diagnostic. PARTIAL means supported damage remains useful but at least one relevant mechanic is excluded. Unsupported is never displayed as a real zero.

## Current Aemeath boundary

Exact Lv90 Resonator and Everbright base stats resolve automatically. Standard actions, Sigillum when explicitly selected, Tune Rupture formulas, and manual Everbright/Trailblazing/Before All Sounds modifiers are inspectable. The existing calibrated reference timeline is selectable and remains partial.

Fusion Burst has a valid event role but no verified damage formula. Hit timings, Starburst emission, Seraphic trigger/consumption timestamps, and demonstrable Instant Response state remain unresolved. The lab does not invent them. It also does not simulate Team DPS, teammate effects, Outro propagation, quickswap, OCR, optimization, or generated rotations.
