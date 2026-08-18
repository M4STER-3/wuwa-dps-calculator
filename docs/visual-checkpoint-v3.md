# Visual checkpoint — V3 shell + Home

This branch is intentionally limited to the first visual checkpoint.

## Included

- coded global background and atmosphere (CSS only);
- V3 design tokens and reusable UI primitives;
- five-item primary navigation;
- new responsive global shell;
- new Home page composition;
- local featured Resonator artwork when a promoted portrait is available;
- accessibility baseline and reduced-motion handling;
- no new dependencies.

## Explicitly not redesigned yet

- Character Box internals;
- Echo editor internals;
- Personal DPS internals;
- Team DPS internals;
- Data compendium internals.

Those screens remain functionally intact so the visual direction can be approved before propagation.

## Architecture unchanged

No Damage / State / Temporal engine logic is changed. `UserBuild.finalStats`, Character Box persistence, Echo validation, promoted game data and security boundaries remain untouched.
