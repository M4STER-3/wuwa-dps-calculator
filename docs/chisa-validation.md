# Chisa validation dossier — research-gated

Verification date: **2026-08-16**.

## Research outcome

Only the task-allowlisted hosts were contacted: WutheringTools, Wuthering Waves Wiki/Fandom, and Prydwen. WutheringTools returned only its human-readable application shell; its game data and calculator require a JavaScript application bundle. Downloading or executing that bundle is expressly forbidden by the mission. Fandom and Prydwen returned Cloudflare challenge pages whose completion likewise requires third-party script execution. No redirect was followed and no non-allowlisted hostname was contacted.

Consequently, no exact Chisa value could be independently read or transcribed under the network policy. This repository does **not** promote recollection, guessed values, interpolation, or engine-produced numbers to verified Game Data or external fixtures. Chisa is therefore not added to the catalog in this change. In particular, Lv90 HP/ATK/DEF/Energy, talent tables, hit groups, resources, Unseen Snare/Havoc Bane/Thread of Bane semantics, sustain formulas, Sequences, equipment, and WutheringTools display results remain **unsupported/unverified**.

## Coverage profile and implementation boundary

| Mechanic | Aemeath | Chisa result in this audit |
| --- | --- | --- |
| ATK and Tune damage calibration | externally calibrated | no admissible Chisa fixture |
| Resources | legacy costs/gains declared | generic atomic staged resolver added; Chisa stages unverified |
| Forms and replacement | generic primitives exist | Chisa mapping unverified |
| Target statuses, stacks and ICD | generic target-local state exists | exact Snare/Bane semantics unverified |
| DEF Reduction vs DEF Ignore | separate formula terms exist | Thread eligibility unverified |
| Multi-hit / hit groups | calibrated totals and groups | Sawring values/modifiers unverified |
| Healing and shields | incomplete | Chisa formulas unverified |
| External ally trigger ownership | generic integration proof exists | Chisa permission/ICD unverified |
| Team/Outro | Team Engine deferred | remains explicitly deferred |

The new resource resolver is Resonator-agnostic. It validates all operations in a stage on a private copy, rejects a partial payment, never permits negative resources, caps gains, preserves the original state after rejection, and returns an ordered audit. A data definition must explicitly declare `before-action` or `after-action`; legacy `CombatAction.costs/gains` remain unsupported because their timing is not encoded.

## External calibration and rotation

No Chisa external benchmark was manufactured. There are zero Chisa benchmark actions, mismatches, or talent checkpoints. No action list, hit timestamp, animation timing, duration, or DPS was inferred. Aemeath remains the calibration reference and its fixture is unchanged.

## Next validation Resonator

Chisa remains the intended second universality stress test once admissible, human-readable exact data is available. Verina remains the intended third validation Resonator and is intentionally **not** implemented here. Verina is useful next because healing, simple resource flow, coordinated attacks, buffs, and the support/team boundary broaden coverage without duplicating Chisa's complexity.

## Classification rationale

The engine cannot honestly claim Chisa support without verified data. The current outcome is therefore **FOUNDATION NOT READY FOR THIRD RESONATOR**: research access, Chisa Game Data, composed Chisa scenarios, external fixtures, and sustain outcomes are still P1 blockers rather than silently ignored functionality.
