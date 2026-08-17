# WUWA LAB visual redesign V2

Status: **Step 1 / 15 — exact global background asset validated**

The visual redesign is tracked separately from calculator functionality. This V2 roadmap restarts visual progress at **0%** and reaches **100% only after all 15 steps are visually validated**.

The calculator architecture, combat engines, persistence, exact Echo resolver, GameDatabase, promoted local assets, and security boundaries are preserved. This roadmap replaces only the presentation layer.

## 1. Locked visual source of truth

The user-approved global background is the supplied WUWA LAB parchment/ink image with:

- a dark ink-painted navigation region on the left;
- five gold icon + empty-label navigation rows;
- warm ivory/parchment content field;
- irregular black ink transition between navigation and content;
- restrained gold line work and decorative motifs;
- no independent Echo navigation item;
- no generated CSS recreation of the parchment/ink artwork.

The background image itself is treated as an immutable visual asset. UI states, text, buttons and interactions must be layered **above** it rather than baked into or painted over the source image.

## 2. Navigation information architecture

The five navigation rows map to:

1. Accueil
2. Character Box
3. DPS personnel
4. DPS équipe
5. Données

Echoes are **not** a standalone primary navigation section. Echo management belongs inside Character Box.

## 3. Asset rules

- The approved global background is a local project asset.
- Do not recolour, regenerate, crop destructively or paint over the source file.
- Responsive behaviour is implemented by layout/CSS around the asset.
- Resonator, weapon and Echo identity imagery remains sourced from the verified local WUWA asset pipeline.
- Gameplay imagery is resolved by stable promoted IDs, never by fuzzy display-name matching.
- RAW imported data remains unavailable to browser UI.

## 4. Test / merge rule

Every visual step is developed on a dedicated branch and PR so the user can test the Cloudflare non-production preview before the next step.

A visual step is not considered validated merely because CI is green. If the user wants to inspect it, the PR stays unmerged until visual approval.

## 5. Fifteen-step roadmap

Each completed and visually validated step represents **6.67%** of the V2 visual redesign (the final step closes the remaining rounding difference to 100%).

- [x] **01 — Exact global background asset.** Add the approved source image unchanged as a local asset and provide a clean full-screen validation route.
- [ ] **02 — Responsive background behaviour.** Define desktop/tablet/mobile sizing, anchoring and fallback without distorting the source artwork.
- [ ] **03 — Interactive left navigation.** Overlay the five real routes on the five image navigation rows: Home, Character Box, Personal DPS, Team DPS, Data.
- [ ] **04 — Navigation states.** Add hover, active, focus and labels above the immutable background without repainting it.
- [ ] **05 — Remove the legacy shell.** Retire the old generated header/sidebar/footer and conflicting dark/cyan shell presentation. **Checkpoint.**
- [ ] **06 — V2 content primitives.** Rework fields, buttons, tabs, separators and panels to fit parchment/ink/gold with less box-driven geometry.
- [ ] **07 — Safe gameplay-image projection.** Expose the minimal stable-ID → local-image surface for Resonators, weapons and Echoes.
- [ ] **08 — Resonator imagery system.** Validate real local portraits/artwork, crops, fallbacks and selected states across a representative sample.
- [ ] **09 — Character Box reconstruction.** Build the central Resonator/build composition on the approved background. **Checkpoint.**
- [ ] **10 — Weapon imagery and selection.** Add real local weapon art, compact metadata and visual selection.
- [ ] **11 — Echoes inside Character Box.** Integrate the existing exact five-Echo editor, real Echo imagery, Main Echo, cost, Sonata and exact substats inside Character Box.
- [ ] **12 — Personal and Team DPS reconstruction.** Recompose build identity, results, breakdowns and rotation/timeline on the V2 visual system. **Checkpoint.**
- [ ] **13 — Game Data reconstruction.** Build the illustrated Resonator / weapon / Echo / Sonata catalogue with filters and details.
- [ ] **14 — Home reconstruction.** Build the final WUWA LAB landing composition and reuse verified local imagery where useful.
- [ ] **15 — Final visual QA and production validation.** Desktop/tablet/mobile, zoom, accessibility, image loading/fallback, performance, full CI and Cloudflare production-bundle verification.

## 6. Architecture boundary

The redesign must not silently alter combat semantics.

- `UserBuild.finalStats` remains the sole permanent-stat source consumed by runtime engines.
- Damage / State / Temporal engines must never rebuild permanent stats from weapon, Echo or Sonata data.
- Unsupported or incomplete calculations remain visibly distinguishable from verified results.
- External descriptions remain inert data and are never interpreted as executable logic.
- Existing Character Box and Echo persistence must survive presentation migrations.

---

**V2 visual progress after Step 1: 6.67%.**
