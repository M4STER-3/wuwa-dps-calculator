# Personal-to-Team engine boundary

Personal simulation remains a one-build calculator. It does not own a three-actor
`TeamState`, switching timeline, or event queue shared by three Resonators.

The coordinated-response bridge intentionally keeps `triggeringActorId`,
`activeActorId`, `sourceEntityId`, `damageOwnerId`, and `scalingOwnerId` separate.
An on-field attack keeps its attacker's damage ownership, while a target-local
effect may emit a response owned and scaled by an off-field actor. Target status
and ICD keys include the target, so one enemy cannot activate or throttle another.

Team Engine v0.1 should provide actor stat lookup by `scalingOwnerId`, aggregate by
`damageOwnerId`, and share current time, targets, effects, cooldowns, and an event
queue. The bridge must not infer any of those identities from the selected Personal
Resonator.
