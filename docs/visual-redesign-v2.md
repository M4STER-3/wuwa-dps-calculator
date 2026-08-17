# WUWA LAB visual redesign V2

Status: **Step 3 / 15 — interactive artwork navigation implemented; Steps 2–3 awaiting visual validation**

The visual redesign V2 is tracked independently from calculator functionality. It starts at 0% and reaches 100% after all 15 visual steps are completed and validated.

## Locked background source

The approved global background is the local immutable asset:

`/assets/ui/wuwa-lab-global-background-4k.png`

Verified source contract:

- PNG
- 3840 × 2160
- 7,593,171 bytes
- SHA-256 `950d2ce6914de7c23493e96b19e9985fedb833d36a40d35517176ef292eb1b82`

The artwork must not be recoloured, redrawn, filtered or baked together with later UI changes. Navigation, hover/selection states and content are layered above it.

## Responsive background contract — Step 2

The responsive layer preserves the approved image geometry rather than stretching the artwork.

- Landscape / desktop: the 16:9 artwork covers the viewport while the left navigation edge stays fixed.
- Portrait / mobile: the exact 16:9 artwork stays at viewport height and may pan horizontally instead of being compressed.
- The source PNG is never edited for responsive behaviour.
- `/visual-test/background` remains the dedicated background test route.

Step 3 refines the implementation into an explicit 16:9 artboard plane so interaction coordinates and the raster artwork always scale together.

## Interactive artwork navigation — Step 3

The five navigation hit targets are transparent overlays measured directly against the approved 3840 × 2160 source. They include each icon plus its adjacent empty label frame and are expressed as percentages of the 16:9 artboard, not viewport guesses.

Routes:

1. Home → `/`
2. Character Box → `/character-box`
3. Personal DPS → `/personal-dps`
4. Team DPS → `/team-dps`
5. Game Data → `/data`

Echoes are not a top-level navigation destination. The Echo loadout/editor is integrated into Character Box while its existing persistence and exact resolver validation are preserved.

Step 3 intentionally adds no decorative hover/active treatment; those visible states belong to Step 4. The links already expose accessible labels and native keyboard semantics.

Test route: `/visual-test/navigation`.

## 15-step roadmap

Each completed step is worth 1/15 of the V2 visual redesign.

- [x] **01 — Install approved global background.** Store and verify the immutable 4K local source plus a clean visual-test route.
- [ ] **02 — Responsive background behaviour.** Preserve the artwork composition across target desktop/tablet/mobile viewports without distortion. **Implemented; awaiting visual approval.**
- [ ] **03 — Interactive left navigation.** Map the five artwork slots to the final top-level routes. **Implemented; awaiting visual approval.**
- [ ] **04 — Navigation states.** Add hover, active, focus and labels as independent UI overlays without editing the background.
- [ ] **05 — Retire legacy shell styling.** Remove conflicting old header/sidebar/content framing and let the approved background become the real site frame. **Checkpoint.**
- [ ] **06 — Rebuild shared interface language.** Controls, typography, dividers and content surfaces designed to sit naturally on the approved artwork.
- [ ] **07 — Safe gameplay-image projection.** Browser-safe stable-ID mappings for local Resonator, weapon and Echo images.
- [ ] **08 — Resonator visual system.** Validate crops, thumbnails, feature artwork and fallbacks with real local assets.
- [ ] **09 — Character Box composition.** Rebuild the central build workspace around the selected Resonator. **Checkpoint.**
- [ ] **10 — Weapon imagery and selection.** Add real local weapon art and compact visual selection.
- [ ] **11 — Echo loadout inside Character Box.** Integrate five real-image Echo slots, Main Echo, cost, Sonata, main stats and exact substats.
- [ ] **12 — Personal and Team DPS redesign.** Rebuild result hierarchy, character identity, rotations, timelines and breakdowns. **Checkpoint.**
- [ ] **13 — Game Data redesign.** Illustrated Resonator / weapon / Echo / Sonata compendium with search and filters.
- [ ] **14 — Final Home composition.** WUWA LAB identity, local character artwork, database counters and entry points using the finished visual language.
- [ ] **15 — Final visual QA and production deployment.** Desktop/tablet/mobile, keyboard/accessibility, image loading, performance, Cloudflare and regression verification. **Final checkpoint.**

## Test / approval workflow

Every testable step uses a short Cloudflare branch alias (`v2-step-XX`) so preview links stay stable and human-readable. Corrections remain isolated until visual approval.

## Architecture boundary

The redesign remains presentation work unless a step explicitly introduces a safe UI projection. It must not change combat semantics.

- `UserBuild.finalStats` remains the only permanent-stat input consumed by runtime combat engines.
- Damage / State / Temporal engines do not rebuild permanent stats from weapon, Echo or Sonata data.
- Existing Character Box persistence is preserved.
- Existing exact Echo resolver validation is preserved.
- External text remains inert and non-executable.
- Real gameplay imagery is resolved from local verified assets by stable promoted IDs, never by display-name guessing or external runtime URLs.

---

**V2 visual redesign: 6.67% validated; Steps 2–3 implemented and awaiting visual approval.**
