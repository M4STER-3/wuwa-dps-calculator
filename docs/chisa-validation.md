# Chisa validation dossier

Verification date: **2026-08-16**. Implementation uses only the externally supplied research packet; Codex performed no further Internet research. Packet sources are Wuthering Waves Wiki/Fandom, Prydwen, Wuwa Wiki, with Wuthering.gg as a display cross-check. Confidence and disagreements remain data-owned.

## Identity and exact base data

Chisa is a 5-star Havoc Broadblade Support/Healer/Negative Status support. Exact Lv90 internal stats are HP `10775.00`, ATK `437.50`, and DEF `1136.65`; common displays are 10775/438/1137. Base Crit is 5%/150%, Energy Regen 100%, Resonance Energy 125, and minor Forte totals are Crit Rate +8% and ATK +12%. Internal ATK/DEF are preserved.

## Exact talent coverage

The generic sparse talent schema stores exact level-owned hit groups and never interpolates. Skill, Forte Chainsaw actions, Liberation, Intro, Eradication shield, and Liberation sustain have complete Lv1–10 packet tables. Most Basic-family actions support exact Lv1 and Lv10 only; Lv2–9 remain unsupported. Heavy Attack supports Lv10 only because Lv1 is disputed (Fandom 8.00%×2 versus multiple current sources 18.00%×2).

Implemented actions include Basic stages 1–2, Rending Lunge, Death Snip and its separate additional component, Thread Withdrawn, Heavy, Mid-air, Severed Facet, Hanging Finality, both Dodge Counters, Eye of Unraveling, Serrated Loop/hold, all supplied Sawring Blitz/hold/additional variants, Chainsaw Dodge/hold, Eradication, Moment of Nihility, and Intro. Damage classifications and ordered hit groups are preserved.

## Universal primitives exercised

- Atomic staged resource transactions reject mixed gain/consume stages, so a gain cannot finance a same-stage cost.
- Sparse exact talent resolution returns unsupported for a missing/disputed level.
- Healing and shield results are distinct typed personal outcomes, not damage.
- Group-targeted additive MV distribution supports Eradication's 20%/80% split without action-id branches.
- Trigger operations can be attributed generically to a definition-owned source when a foreign actor triggers an owned status.
- Exact Sequence-owned cooldown overrides model S4's target ICD without a Chisa branch.

## Resources, forms, and unknown timing

Ring of Chainsaw, Lifethread - Jetstream, Chainsaw Fever, Resonance Energy, and Concerto are structured with verified caps. Known costs/gains remain declared; unknown per-hit Ring quantities are not guessed. Lifethread regen/lockout, Chainsaw Fever grace/depletion, Burnout Ring depletion, hit timestamps, animation timings, and rotation duration remain unsupported. Scissors/Chainsaw forms and exact action requirements are data-owned; transitions requiring unknown timestamps remain descriptive rather than synthesized.

## Unseen Snare, Havoc Bane, and Thread of Bane

Unseen Snare is target-local for 30s. Verified action-hit applications are structured; lock-on remains an external/manual event because it is not a combat action. Direct Resonator damage to a Snared target applies one Chisa-owned Havoc Bane stack with a target-local 2s ICD, reduced to 1s at S4. External ally damage is never aggregated as Chisa personal damage.

Current v2.8+ Havoc Bane is a Negative Status, max 3 at base, reducing enemy DEF by 2% per stack. It emits no periodic damage. Exact duration/refresh is not verified, so automatic expiry is unsupported. Outro's team-context max-cap increase to 6 is stored/deferred.

Thread of Bane is a separate attacker-side 18% DEF Ignore against a Snared target. It is manual/explicit in Personal context; teammate propagation through Outro is deferred. Numerical tests keep target DEF Reduction and attacker DEF Ignore as independent terms.

## Sustain, Sequences, and equipment

Death Snip and Liberation healing plus Eradication shielding use exact packet formulas. Nearby-team propagation is deferred; Personal Lab exposes formula amounts and shield duration. All Ends Here supplies runtime Havoc/Healing bonuses.

Safely modeled personal Sequence pieces include S2 Havoc RES Ignore, S3 Chainsaw MV-layer increase, S4 ICD, and S5 Liberation bonus. S1 fixed capped damage, interruption immunity, Vibration, S6 fatal-hit prevention/Finality, and Team-only pieces remain stored or explicitly unsupported.

Kumokiri R1 stores permanent ATK as already-in-final-stats, runtime Liberation stacks, and deferred team behavior. Thread of Severed Fate stores its 5s runtime ATK/Liberation effects. Reminiscence: Threnodian - Leviathan is editorial metadata only; its action/equipment effects were not supplied and are not invented.

## External calibration and rotation

No Chisa WutheringTools fixture exists yet. No Normal/Average/Crit or per-hit values are derived from this engine and labeled external. The supplied structural rotation is informational only; no duration, hit timings, or DPS claim is created. Aemeath remains the external calibration reference; Chisa is the second universality stress test. Verina remains the intentionally deferred third candidate.
