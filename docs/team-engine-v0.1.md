# Universal Team Engine V0.1

## Architecture and identity

The Team Engine is a domain/runtime layer for an arbitrary one-to-three actor team. It performs one simulation; it never adds three Personal simulations. `actorId` is the unique runtime instance identity (for example, `slot-1`), while `resonatorId` remains catalog identity. Array position has no runtime meaning. Aemeath, Chisa, and Verina are integration fixtures, not architectural assumptions.

`TeamState` owns the active actor, actor map, one clock, target-id keyed state, active effects, cooldowns, queue, diagnostics, and coverage. Every `TeamActorState` retains its resolved build/final stats, Sequence, talent levels, resources, forms/states, actions, and switch return time. Loadout-provided structured runtime effects can be registered per actor; permanent effects accounted for in `finalStats` are not activated again.

## Timeline, queue, and actions

Action, switch, and wait are the V0.1 rotation-step contract. Direct actions require their actor to be active. Data-emitted follow-up, coordinated, summon, and status work is scheduled separately and may execute for an off-field owner. One deterministic queue survives switches and drains by timestamp then event id as global time advances. Durations, status expiry, cooldowns, target ICD keys, delayed work, and actor resources therefore remain continuous.

Verified action cast duration advances time. A manual duration override is accepted and recorded as a transition. With neither, damage at the known timestamp may resolve, but `timing-required` makes duration incomplete. No DPS is exposed or inferred.

## Ownership and outcomes

Trigger, active actor, source, damage owner, and scaling owner remain independent. Damage lookup requires an existing `scalingOwnerId` and uses that actor's `finalStats`; it never falls back to the active actor. Attribution requires an existing `damageOwnerId`. Results expose chronological damage events plus totals by actor for later aggregation, but not Team DPS.

Healing and shields reuse the existing exact outcome calculators. Team results preserve outcome owner, scaling owner, recipients, amount, and timestamp, and emit `heal-applied` or `shield-gained` events. HP, overheal, death, and shield depletion simulation remain out of scope.

## Switching and Intro/Outro

Switch ordering is deterministic: outgoing `switch-out`; readiness evaluation and optional outgoing `outro`; active actor update; incoming `switch-in`; optional incoming `intro`. This ordering is logical, not a frame-perfect timing claim. The actor leaving receives an isolated one-second return cooldown; other actors remain switchable.

Standard readiness finds a full resource classified by the generic `concerto-energy` semantic, consumes it, and emits Outro/Intro. It does not inspect a resource or Resonator id. `TeamSwitchReadinessRule` is the data extension point: a structured state token can alternatively enable switching and optionally be consumed, without changing switch logic. Missing exact Intro action data does not fabricate Intro damage; the event remains visible for data-driven processing.

## Recipients and lifecycle

Recipient resolution supports `self`, `team`, `other-team-members`, `enemy`, `incoming-resonator`, and `active-resonator`. Active instances record resolved `affectedEntityIds`. `EffectLifecycle.endOnSwitchOut` can end an effect when its affected recipient or its owner leaves. This is event-driven structured data, not description parsing; an unrelated teammate switching does not end a recipient-bound effect.

Targets are keyed by target id. A status, mark, debuff, or target-local ICD applied to one target remains visible after its owner switches out and cannot leak to another target. Enemy DEF reduction remains target state, distinct from attacker-side DEF ignore.

## Deferred and unsupported V0.1 behavior

V0.1 intentionally does not implement UI, rotation construction, Team DPS/cycle validation, quickswap overlap, simultaneous actors, frame calibration, automatic optimization, probabilistic crit events, full health/death, speculative animation timing, or speculative team/off-field Resonance Energy propagation. Unknown propagation remains `team-energy-propagation-required`; unsupported exact context remains diagnostic/partial. Actor-owned exact resource operations reuse the atomic resource transaction resolver.

The next Rotation Builder may consume `TeamRotationStep` and `TeamSimulationResult`. The V0.2 catalog adapter now discovers Intro actions and structured Outro listeners generically and binds structured loadout data without character-specific Team Engine branches.

## V0.2 catalog binding and supplied system rules

`bindTeamActorRuntime` wraps immutable catalog actions, resources, coordinated responses, and structured Resonator/Weapon/Sonata/Main Echo effects with a runtime `ownerActorId`. Catalog `resonatorId` and effect/action `sourceEntityId` remain audit identities; they are never substituted for the actor instance id. A fresh binding owns fresh resource, cooldown, target, and active-instance state, so imported catalog singletons are neither mutated nor used as runtime storage.

The supplied V0.2 system rules are: a normal team has up to three Resonators; this sequential non-quickswap abstraction controls one actor at a time; the actor leaving receives an isolated one-second return cooldown; full semantically-classified Concerto consumes that resource and derives outgoing Outro plus incoming Intro; and switch-bound effect lifecycle is generic. Outro and Intro are coarse events at the same switch timestamp. Processing order is `switch-out`, `outro`, active-actor update, `switch-in`, `intro`; this deterministic order is not a claim of frame-perfect simultaneity.

Intro discovery uses `CombatAction.talent === "introSkill"`, returning a list so future form/state requirements can select variants. Outro discovery uses only structured triggers whose event is `outro`; legacy prose remains informational. Unknown Intro hit timing emits the occurrence plus `timing-required` rather than fabricated damage.

Team damage resolution uses the existing exact talent and Standard Damage engines. The adapter selects stats strictly by bound `scalingOwnerId`, resolves all active actor/team/enemy instances plus target-owned status modifiers, and records effect audit contributions. Target statuses are keyed by definition and runtime owner so two actor instances can own the same status without collapsing ownership. Real Photosynthesis and Chisa status definitions flow through this binding; character names remain confined to Game Data and integration tests.
