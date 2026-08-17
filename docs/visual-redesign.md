# WUWA LAB visual redesign

Status: **Step 6 / 20 — background / texture system defined**

This document is the visual source of truth for the WUWA LAB redesign. Visual-redesign progress is tracked separately from calculator functionality: it starts at 0% and reaches 100% only after all 20 visual steps are complete.

## 1. Locked art direction

WUWA LAB should feel like a premium Wuthering Waves theorycraft companion rather than a generic SaaS dashboard or RGB gaming tool.

The supplied visual reference establishes this direction:

- **Primary surfaces:** warm ivory / parchment-like content surfaces.
- **Contrast surfaces:** deep charcoal / ink-black navigation, selected states and image-led cards.
- **Accents:** restrained antique gold / warm beige. Gameplay colours are reserved for actual gameplay meaning.
- **Borders:** thin, precise, slightly warm neutral lines.
- **Shape language:** rectangular and editorial, with restrained corner radii.
- **Texture:** subtle paper / grain / ink treatment may add atmosphere but never reduce data readability.
- **Typography:** editorial display hierarchy plus compact technical UI/data typography.
- **Density:** information-rich but ordered, closer to a technical field guide than a spacious SaaS dashboard.
- **Illustration:** Resonator, weapon and Echo imagery becomes part of navigation and recognition, not decoration only.
- **Motion:** restrained and functional. No RGB glow, animated grain or attention-seeking motion.

This is a visual direction, not a request to reproduce the official Wuthering Waves UI or the reference image pixel-for-pixel.

## 2. Legacy styling to remove progressively

The old full-screen dark teal/cyan dashboard presentation is legacy styling during the migration. New redesign work must not treat it as the target.

The redesign should progressively remove or strongly reduce:

- full-screen black/blue as the default content surface;
- cyan as the dominant brand colour;
- large generic rounded SaaS panels;
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
5. **Character Box, Echoes, Personal DPS, Team DPS and Game Data must share one visual grammar.**
6. **Mobile is a reflow of the same product, not a separate visual system.**
7. **Only local verified imagery is used in the future image pipeline.**

## 4. Page-level targets

### Home
Editorial WUWA LAB hero, restrained character artwork, compact database counters and strong dark module navigation.

### Character Box
Compact Resonator gallery, selected-character presentation, weapon, permanent stats and build summary in one structured editorial composition.

### Echo editor
Five coherent image-led Echo cards with Main Echo, cost, Sonata, main stats and substats readable without a wall of selects.

### Personal DPS
Build identity and result lead visually: DPS, duration, total damage, breakdown and rotation timeline. Diagnostics and sandbox controls become secondary.

### Team DPS
Three character identities, team result, rotation timeline, buffs and per-character contribution form the main hierarchy.

### Game Data
Illustrated compendium/catalogue with compact filters and detailed information after selection.

## 5. Image integration boundary

Real game imagery is intentionally **not wired in Steps 1–7**. Browser-safe integration begins at Step 8 after the visual foundations and illustrated-card contract exist.

Image sequence:

- **Step 8:** safe stable-ID → local asset UI projection;
- **Step 9:** first cross-category rendering proof for Resonators, weapons and Echoes;
- **Step 11:** Resonator portraits/artwork in Character Box;
- **Step 12:** weapon imagery and visual selection;
- **Step 15:** Echo imagery in the five-slot editor;
- **Steps 17–19:** reuse imagery in Home, DPS and Game Data.

Image rules:

- resolve by stable promoted IDs;
- use local files from the existing GameAssetRegistry or a derived safe projection;
- never infer associations from display names;
- never expose RAW imported data to the browser;
- provide deterministic missing-image fallbacks;
- optimise thumbnail and large-artwork use separately where practical.

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

## 7. Twenty-step redesign roadmap

Each completed step represents **5%** of the visual redesign.

- [x] **01 — Lock art direction.** Establish reference language, non-goals and product principles.
- [x] **02 — Design tokens.** Define colour, surface, border, radius, shadow and spacing tokens.
- [x] **03 — Typography system.** Define heading, body, stat, label and numeric hierarchy.
- [x] **04 — Shared UI primitives.** Build panels, cards, buttons, tabs, fields, badges, stat rows, dividers and tooltips.
- [x] **05 — Global shell.** Rebuild navigation, page frame and footer. **Checkpoint passed.**
- [x] **06 — Background / texture system.** Implement restrained paper, grain and decorative treatment with accessibility/performance constraints.
- [ ] **07 — Illustrated card system.** Create reusable image-led cards for Resonators, weapons and Echoes.
- [ ] **08 — Safe UI asset projection.** Expose only local stable-ID image mappings required by browser UI.
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

## 9. Architecture boundary during the redesign

The redesign is presentation work unless a step explicitly requires a safe UI projection. It must not silently change combat semantics.

In particular:

- `UserBuild.finalStats` remains the sole permanent-stat source consumed by runtime engines;
- Damage / State / Temporal engines must never rebuild permanent stats from weapon, Echo or Sonata data;
- unsupported or incomplete calculations remain visibly distinguishable from verified results;
- external descriptions remain inert data and are never interpreted as executable logic;
- visual/image work must not bypass the established data and asset security boundaries.

---

**Visual redesign progress after Step 6: 30%.**
