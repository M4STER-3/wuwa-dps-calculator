# WUWA LAB — visual redesign V4

Status: **Step 1 / 15 — visual direction locked**

V4 replaces the abandoned full-screen background-image and dark Spectral Mineral experiments. The calculator is redesigned as a fully coded React / Next.js / CSS interface. The reference direction is a light, premium, technical product language, but no reference screenshot is treated as a page blueprint.

The redesign is tracked separately from calculator functionality. Each completed step represents roughly 6.67% of V4, with Step 15 closing the rounding difference to 100%.

## 1. Product identity

WUWA LAB should feel like a purpose-built Wuthering Waves theorycraft workstation rather than a generic SaaS dashboard.

The UI should be:

- predominantly light and calm;
- dense enough for expert buildcraft without becoming visually heavy;
- highly structured through alignment, spacing and hierarchy;
- image-aware: Resonators, weapons and Echoes are first-class interface elements;
- precise and technical, with restrained decorative treatment;
- comfortable for long sessions and repeated comparison work;
- responsive by recomposition, not by shrinking a desktop canvas.

The exact accent palette is intentionally not frozen in Step 1. Step 2 will select accessible production colours inside this light-system direction.

## 2. Explicit non-goals

V4 must not return to:

- a full-screen illustration or raster image used as the site shell;
- parchment / ink / antique-gold presentation;
- a globally dark gaming interface;
- dominant cyan, RGB glow or decorative bloom;
- a wall of identical cards;
- repeated nested rectangles around every data group;
- large empty hero space that displaces useful build information;
- form-first pages dominated by native select elements;
- a generic enterprise/SaaS dashboard aesthetic.

The legacy 4K background asset may remain in the repository temporarily for historical cleanup, but V4 production UI must not depend on it.

## 3. Information architecture

Primary navigation is limited to:

1. Accueil
2. Character Box
3. DPS personnel
4. DPS équipe
5. Données

Echoes are not a primary destination. Echo management belongs inside Character Box.

Home is deliberately **not** the visual source of truth for V4. It will be redesigned near the end, once Character Box, imagery, DPS and Data have established the real product language.

## 4. Character Box is the flagship visual page

Character Box defines the design quality bar for the rest of WUWA LAB.

A user opening Character Box should understand the active build at a glance before reading individual form controls.

The target composition contains five visual layers.

### 4.1 Resonator browser

A compact visual browser with:

- real local portraits;
- search;
- useful filters when supported by promoted data;
- clear hover / selected / unavailable states;
- keyboard navigation;
- compact density suitable for dozens of Resonators.

The browser is a reusable component for Character Box, DPS and Game Data.

### 4.2 Selected Resonator identity

The selected build gets a dominant identity plane containing:

- portrait or larger artwork when a suitable verified local asset exists;
- name and level;
- concise build identity metadata;
- important permanent stats;
- clear build-completeness state.

Artwork should participate in the layout rather than sit in a decorative card with no functional relationship to the data.

### 4.3 Weapon

The equipped weapon should be immediately recognisable through real local imagery.

Show, as supported by existing data:

- weapon image;
- name;
- level;
- rank / refinement state;
- relevant permanent stats;
- concise effect information as inert display text.

Weapon selection should use a searchable/filterable visual picker rather than rendering all weapons as large cards simultaneously.

### 4.4 Echo loadout

The existing exact five-Echo build model is surfaced directly inside Character Box.

The visual layer must support:

- five slots;
- an unmistakable Main Echo;
- real local Echo imagery;
- cost and total cost context;
- Sonata context;
- main stat;
- substats;
- replace/edit actions;
- searchable/filterable visual selection.

The UI must preserve the existing resolver validation and persistence rather than reimplementing Echo rules in presentation code.

### 4.5 Build summary

A compact summary ties Resonator, weapon, Echoes and permanent stats together and provides clear entry points to DPS calculation.

The summary should optimise scanning and comparison rather than repeat every field already visible elsewhere.

## 5. Asset presentation contract

Gameplay imagery is functional UI, not wallpaper.

Required reusable presentation roles include:

- compact Resonator portrait;
- selected Resonator identity artwork;
- weapon thumbnail / equipped weapon image;
- Echo thumbnail / slot image;
- compact identity chip for DPS and timelines;
- catalogue thumbnail for Game Data;
- deterministic missing-image fallback.

Asset rules:

- use the existing verified local asset pipeline;
- resolve imagery by stable promoted IDs;
- never infer a file association from display names;
- never depend on external runtime image URLs;
- RAW imported data remains unavailable to browser UI;
- crop behaviour must be explicit per asset role;
- avoid loading large artwork when a thumbnail role is sufficient;
- preserve accessible text identity independently from imagery.

## 6. Composition language

V4 is block-based, but not box-saturated.

Prefer this hierarchy:

1. spacing and alignment;
2. typography and contrast;
3. subtle surface change;
4. divider or partial grouping;
5. bordered card only where a real interaction/data boundary exists.

Use larger surfaces for major product regions and smaller cards only for actual selectable objects, statistics, or discrete summaries.

Avoid three-level card nesting.

## 7. Surface and depth direction

The exact token values are chosen in Step 2, but the roles are fixed now:

- light application canvas;
- white / near-white primary workspace surfaces;
- slightly tinted secondary surfaces;
- dark high-contrast text;
- quieter metadata text;
- thin neutral borders;
- restrained accessible accent colour;
- very soft elevation, mostly for floating/selectable elements;
- semantic success / warning / danger states independent from the brand accent.

The overall visual weight must remain light even on dense pages.

## 8. Typography and numeric hierarchy

Typography should feel modern and technical, not ornamental.

Requirements:

- strong page and section hierarchy;
- compact labels and metadata;
- tabular/lining numerals for stats and DPS;
- clearly differentiated primary results versus supporting values;
- readable long-form descriptions without oversized line lengths;
- no external font dependency unless explicitly justified later.

## 9. Interaction language

All reusable controls need explicit:

- default;
- hover;
- active/selected;
- keyboard focus;
- disabled;
- loading;
- error states.

Advanced settings should remain available but visually subordinate to build identity and calculation results.

Dialogs/drawers may be used for large visual selectors when this reduces page clutter, but essential build state must remain visible without reopening them.

## 10. Responsive contract

Target environments include 2560×1440, 1920×1080, laptop widths, tablet and mobile.

Rules:

- desktop may use multi-column build compositions;
- tablet recomposes panels instead of scaling them down;
- mobile uses a dedicated stacked flow and compact navigation;
- artwork may crop responsively but must not control document geometry;
- wide tables/timelines require an intentional mobile strategy;
- no fixed-resolution artboard assumptions.

## 11. Architecture and security boundary

V4 is presentation work unless a roadmap step explicitly adds a safe UI projection.

The following contracts remain unchanged:

- `UserBuild.finalStats` is the sole permanent-stat source consumed by runtime combat engines;
- Damage / State / Temporal engines do not rebuild permanent stats from weapon, Echo or Sonata data;
- Character Box persistence remains intact;
- existing exact Echo resolver validation remains intact;
- game values are not invented or interpolated;
- imported descriptions remain inert, non-executable data;
- curated combat data is not automatically replaced by external imported content;
- Cloudflare / security boundaries are not weakened for visual convenience.

## 12. V4 roadmap — 15 steps

- [x] **01 — Lock the light coded visual direction.** Define product language, Character Box target, asset roles, non-goals and architecture boundaries.
- [ ] **02 — Build the V4 design system.** Production colour tokens, typography, surfaces, controls, cards, stat rows, selectors, dialogs, loading/error states and layout primitives.
- [ ] **03 — Rebuild the global shell.** Light navigation, top-level frame, search/action region and responsive navigation without redesigning Home as the source of truth. **Checkpoint.**
- [ ] **04 — Safe gameplay-image UI projection.** Expose the minimal stable-ID local image mappings required for Resonators, weapons and Echoes.
- [ ] **05 — Asset presentation components.** Portrait, artwork, weapon, Echo, identity-chip and catalogue roles; validate crop, fallback and loading on representative real assets. **Checkpoint.**
- [ ] **06 — Resonator browser.** Searchable/filterable visual selector reusable across Character Box, DPS and Data.
- [ ] **07 — Character Box structure.** Recompose the flagship page around build identity instead of the legacy form layout.
- [ ] **08 — Character Box Resonator + permanent stats.** Real imagery, level/build identity and compact permanent-stat hierarchy.
- [ ] **09 — Character Box weapon.** Equipped weapon identity and visual weapon picker with existing build semantics.
- [ ] **10 — Character Box Echo loadout.** Five image-led Echo slots and visual picker inside Character Box while preserving exact validation/persistence. **Major checkpoint.**
- [ ] **11 — Character Box final UX pass.** Density, incomplete/error states, responsiveness, keyboard flow and build summary.
- [ ] **12 — Personal DPS redesign.** Build identity, major results, breakdown, rotation/timeline and secondary advanced controls. **Checkpoint.**
- [ ] **13 — Team DPS redesign.** Three-character identity, contribution, buffs, shared rotation/timeline and interactions.
- [ ] **14 — Game Data visual compendium.** Resonator / weapon / Echo / Sonata catalogue, search, filters and detailed selection; stress-test asset presentation at catalogue scale.
- [ ] **15 — Home + final responsive/QA/security pass.** Design Home from the finished product language, remove obsolete visual code/assets where safe, complete responsive/accessibility/performance verification, full CI/Cloudflare validation and a new independent security audit before declaring 100%.

## 13. Test and merge rule

Every implementation step uses a dedicated branch / pull request.

When a step produces visible UI, provide its actual Cloudflare preview link for visual testing before merge whenever possible. Do not fabricate preview URLs from long branch names.

A green CI run proves technical integrity, not visual approval. Visual checkpoints remain unmerged until the direction has been reviewed when requested.

---

**V4 visual progress after Step 1: 6.67%.**
