# Universal DPS D2 checkpoint

This draft checkpoint validates the generic personal-DPS engine against the current 10R1 Character Box baseline.

- Pilot profiles: Aemeath, Calcharo, Changli.
- Permanent stat input: `UserBuild.finalStats` only.
- Action values are data-owned; the engine contains no character-name branches.
- WutheringTools fixtures are used as offline external conformance checks with identical displayed stats.
- Rotation DPS per second is emitted only when the total duration is backed by a reviewed temporal source; otherwise the exact supported rotation damage is shown without inventing a duration.
- Calcharo's uncategorized Outro remains explicitly outside the standard damage-type subtotal until a reusable neutral/untyped damage category is represented in the shared formula model.
