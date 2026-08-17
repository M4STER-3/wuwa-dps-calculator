# WUWA LAB visual redesign

Status: **Step 8 / 20 — browser-safe asset projection defined**

This document is the visual source of truth for the WUWA LAB redesign. Visual-redesign progress is tracked separately from calculator functionality: it starts at 0% and reaches 100% only after all 20 visual steps are complete.

## 1. Locked art direction

WUWA LAB should feel like a premium Wuthering Waves theorycraft companion rather than a generic SaaS dashboard or RGB gaming tool.

The supplied visual reference establishes this direction:

- **Primary surfaces:** warm ivory / parchment-like content surfaces.
- **Contrast surfaces:** deep charcoal / ink-black navigation, selected states and image-led cards.
- **Accents:** restrained antique gold / warm beige. Gameplay colours are reserved for actual gameplay meaning.
- **Borders:** thin, precise, slightly warm neutral lines.
- **Shape language:** editorial and slightly irregular rather than box-driven. Use partial frames, restrained cut corners, layered planes, overlap and directional separators before adding another complete rectangle.
- **Texture:** subtle paper / grain / ink treatment may add atmosphere but never reduce data readability.
- **Typography:** editorial display hierarchy plus compact technical UI/data typography.
- **Density:** information-rich but ordered, closer to a technical field guide than a spacious SaaS dashboard.
- **Illustration:** Resonator, weapon and Echo imagery becomes part of navigation and recognition, not decoration only.
- **Motion:** restrained and functional. No RGB glow, animated grain or attention-seeking motion.

This is a visual direction, not a request to reproduce the official Wuthering Waves UI or the reference image pixel-for-pixel.

### Shape-composition rule

A section should not automatically become a bordered rectangle. Prefer, in order:

1. alignment and spacing;
2. typography and contrast;
3. a directional rule or partial frame;
4. overlapping paper/ink planes;
5. a restrained cut-corner container only when a real boundary is useful.

Avoid repeated nested rectangles, equal-width dashboard grids, large generic rounded cards, and perfect geometric repetition when the content can remain clear with a more editorial composition. Decorative asymmetry must stay subtle enough that technical values still scan quickly.

## 2. Legacy styling to remove progressively

The old full-screen dark teal/cyan dashboard presentation is legacy styling during the migration. New redesign work must not treat it as the target.

The redesign should progressively remove or strongly reduce:

- full-screen black/blue as the default content surface;
- cyan as the dominant brand colour;
- large generic rounded SaaS panels;
- repeated complete rectangular frames around every content group;
- excessive pill badges;
- oversized empty spacing around technical data;
- controls visually dominating the content;
- text-only equipment selection when useful local imagery is available;
- decorative glow as a hierarchy mechanism.

Legacy CSS can remain temporarily where a feature has not reached its dedicated redesign step. It must not be globally remapped in a way that breaks contrast.

## 3. Product principles

1. **Data readability comes first.**
2. **Game imagery should improve recognition and navigation.**
3. **Permanent and runtime state must remain visually understandable.**
4. **Dense does not mean cluttered: alignment, type and separators should do more work than giant containers.**
5. **Composition should do more work than boxes: use layering, overlap, partial lines and asymmetric balance before complete frames.**
6. **Character Box, Echoes, Personal DPS, Team DPS and Game Data must share one visual grammar.**
7. **Mobile is a reflow of the same product, not a separate visual system.**
8. **Only local verified gameplay imagery is used in the future image pipeline.**

## 4. Page-level targets

### Home
Editorial WUWA LAB hero, restrained character artwork, compact database counters and strong dark module navigation.

### Character Box
Compact Resonator gallery, selected-character presentation, weapon, permanent stats and build summary in one structured editorial composition. The page should avoid a wall of equally weighted panels: selected character artwork and build identity must create a clear dominant plane.

### Echo editor
Five coherent image-led Echo cards with Main Echo, cost, Sonata, main stats and substats readable without a wall of selects. The loadout should read as one composition rather than five unrelated form boxes.

### Personal DPS
Build identity and result lead visually: DPS, duration, total damage, breakdown and rotation timeline. Diagnostics and sandbox controls become secondary.

### Team DPS
Three character identities, team result, rotation timeline, buffs and per-character contribution form the main hierarchy.

### Game Data
Illustrated compendium/catalogue with compact filters and detailed information after selection.

## 5. Image integration boundary

Real game imagery is intentionally **not rendered in Steps 1–8**. Browser-safe asset mapping is established in Step 8, and Step 9 is the first real presentation proof.

Image sequence:

- **Step 8:** safe stable-ID → local asset UI projection;
- **Step 9:** first cross-category rendering proof for Resonators, weapons and Echoes;
- **Step 11:** Resonator portraits/artwork in Character Box;
- **Step 12:** weapon imagery and visual selection;
- **Step 15:** Echo imagery in the five-slot editor;
- **Steps 17–19:** reuse imagery in Home, DPS and Game Data.

Image rules:

- resolve by stable promoted/source IDs;
- use local files from the verified asset manifest through the browser-safe projection;
- never infer associations from display names;
- never expose RAW imported data to the browser;
- never expose source image URLs to browser feature code;
- provide deterministic missing-image fallbacks;
- optimise thumbnail and large-artwork use separately where practical.

Generated decorative imagery is optional, not required for the redesign. Shape language, layering, colour and layout must work in CSS/components first. If original generated decorative assets are introduced later, they should be limited to WUWA LAB-specific ornamentation/background motifs, while actual Resonator, weapon and Echo identity imagery remains sourced from the verified local game-asset pipeline.

## 6. Foundation contracts

### Design tokens — Step 2

The `--wuwa-*` namespace defines:

- canvas / paper / raised paper / muted paper surfaces;
- ink / soft ink / raised ink surfaces;
- primary, muted and faint ink text plus on-ink text;
- antique-gold accent levels;
- warm line levels;
- muted semantic success / warning / danger / info states;
- keyboard focus colour;
- restrained radii and shadows;
- spacing, page-width and control-height scales.

New redesign components consume these tokens directly. Legacy `--background`, `--panel`, `--accent` and similar variables remain compatibility aliases only for unmigrated features.

### Typography — Step 3

`src/app/typography.css` defines three roles:

- display serif for editorial titles and very large result numbers;
- native/system sans-serif for UI, body copy and controls;
- stable sans-serif data role with tabular/lining numerals.

No external font dependency or hosted font request is introduced.

### Shared UI primitives — Step 4

`src/components/ui/wuwa-ui.tsx` and `src/app/ui-primitives.css` provide reusable presentation-only building blocks:

- paper/ink panels and cards;
- primary, secondary, ghost and destructive buttons;
- compact semantic badges;
- tabs;
- labelled inputs/selects;
- stat rows;
- dividers;
- supplementary keyboard-accessible tooltips;
- editorial section headers.

They contain no game, persistence, remote-data or combat logic.

These primitives are building blocks, not a mandate to wrap every section in a panel. Later feature pages should prefer the shape-composition rule above.

### Global shell — Step 5 checkpoint

The previous horizontal SaaS header was replaced with the first fully migrated product frame:

- persistent desktop ink navigation rail;
- numbered, route-aware navigation with restrained gold active state;
- compact warm-paper workspace context bar;
- native responsive mobile menu;
- warm-paper footer;
- warm keyboard focus treatment.

Unmigrated feature pages intentionally remain dark inside this new shell until their own page steps. See `docs/site-shell.md`.

### Background / texture system — Step 6

`src/app/background-system.css` provides static, reusable paper and ink background roles built entirely with CSS gradients.

It introduces:

- warm paper canvas lighting;
- very fine paper fibre treatment;
- restrained ink grain and warm illumination;
- a thin editorial-rule utility;
- shell application for context bar, footer, desktop rail and mobile header;
- a subtle transition into still-legacy dark content.

There are no raster texture assets, data-URI textures, remote resources, animated grain, JavaScript texture generation or fixed blur layers.

Texture is decorative only. `prefers-contrast: more` and `forced-colors: active` remove it. See `docs/background-system.md`.

### Illustrated card system — Step 7

`src/components/ui/wuwa-illustrated-card.tsx` and `src/app/illustrated-card.css` define the image-led presentation contract before real game assets are exposed to browser UI.

The system provides:

- explicit `resonator`, `weapon`, and `echo` kinds;
- `gallery`, `standard`, and `feature` densities;
- deterministic CSS-only R/W/E fallbacks;
- subtle cut-corner silhouettes instead of generic rounded rectangles;
- partial artwork frames rather than complete nested boxes;
- slightly overlapping information planes;
- layered feature composition rather than rigid equal columns;
- native selectable button semantics with `aria-pressed`;
- explicit unavailable state;
- reduced-motion, high-contrast, and forced-colours fallbacks.

Step 7 still has no access to GameAssetRegistry or external URLs. See `docs/illustrated-cards.md`.

### Browser-safe asset projection — Step 8

Step 8 derives a deliberately narrow browser projection from `public/assets/wuwa/manifest.json` instead of exposing the source manifest directly.

The generated V1 projection contains only:

- `characters`, `weapons`, or `echoes` category;
- exact stable source ID;
- exact normalized asset role;
- same-origin content-addressed `/assets/wuwa/objects/<sha>.(png|jpg|webp)` path.

It excludes names, source URLs, source prose, MIME metadata, byte counts, formulas, stats, RAW payloads and combat data. IDs remain values rather than browser object keys. Runtime validation rejects unknown fields, external/traversal paths, duplicates and count mismatches. Future image resolution uses exact IDs and explicit roles only, never fuzzy/display-name matching.

The projection is regenerated before development and all production/Cloudflare build or deployment commands, and is exposed through `/api/wuwa/ui-assets`. Step 8 still renders no real artwork; Step 9 is the first visual proof. See `docs/ui-asset-projection.md`.

## 7. Twenty-step redesign roadmap

Each completed step represents **5%** of the visual redesign.

- [x] **01 — Lock art direction.** Establish reference language, non-goals and product principles.
- [x] **02 — Design tokens.** Define colour, surface, border, radius, shadow and spacing tokens.
- [x] **03 — Typography system.** Define heading, body, stat, label and numeric hierarchy.
- [x] **04 — Shared UI primitives.** Build panels, cards, buttons, tabs, fields, badges, stat rows, dividers and tooltips.
- [x] **05 — Global shell.** Rebuild navigation, page frame and footer. **Checkpoint passed.**
- [x] **06 — Background / texture system.** Implement restrained paper, grain and decorative treatment with accessibility/performance constraints.
- [x] **07 — Illustrated card system.** Create reusable image-led cards for Resonators, weapons and Echoes with the less-boxed editorial shape language.
- [x] **08 — Safe UI asset projection.** Expose only local stable-ID image mappings required by browser UI; no real artwork is rendered yet.
- [ ] **09 — Asset presentation proof.** Validate crop, fallback, sizing and loading on a small cross-category sample. **Checkpoint.**
- [ ] **10 — Character Box layout.** Recompose the page before final imagery polish.
- [ ] **11 — Character imagery.** Integrate real local Resonator portraits/artwork into Character Box.
- [ ] **12 — Weapon imagery.** Integrate real local weapon imagery and visual selection.
- [ ] **13 — Character Box final visual pass.** Finish density, states, filters, build summary and responsive behaviour. **Checkpoint.**
- [ ] **14 — Echo editor layout.** Recompose the five-slot loadout around image-led cards and compact controls.
- [ ] **15 — Echo imagery.** Integrate real local Echo imagery while preserving exact resolver validation.
- [ ] **16 — Visual Echo picker.** Replace the giant selection flow with a searchable/filterable image catalogue. **Checkpoint.**
- [ ] **17 — Home redesign.** Build the final WUWA LAB landing composition using the established system.
- [ ] **18 — Personal / Team DPS redesign.** Recompose result hierarchy, timelines, breakdowns and controls. **Checkpoint.**
- [ ] **19 — Game Data redesign.** Build the unified illustrated catalogue for Resonators, weapons, Echoes and Sonata.
- [ ] **20 — Final visual QA.** Desktop/tablet/mobile, accessibility, loading/error states, image performance, consistency and production build verification.

## 8. Checkpoint rule

Steps 5, 9, 13, 16 and 18 are explicit visual checkpoints. If the direction looks wrong at a checkpoint, fix the shared language before carrying it into additional pages.

The Step 9 checkpoint must explicitly assess whether the result remains too geometric/box-driven once real imagery is present. If so, shape, overlap and framing must be corrected there before Character Box layout work begins.

## 9. Architecture boundary during the redesign

The redesign is presentation work unless a step explicitly requires a safe UI projection. It must not silently change combat semantics.

In particular:

- `UserBuild.finalStats` remains the sole permanent-stat source consumed by runtime engines;
- Damage / State / Temporal engines must never rebuild permanent stats from weapon, Echo or Sonata data;
- unsupported or incomplete calculations remain visibly distinguishable from verified results;
- external descriptions remain inert data and are never interpreted as executable logic;
- visual/image work must not bypass the established data and asset security boundaries.

---

**Visual redesign progress after Step 8: 40%.**
