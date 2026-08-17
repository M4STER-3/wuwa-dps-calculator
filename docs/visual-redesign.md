# WUWA LAB visual redesign

Status: **Step 1 / 20 — direction locked**

This document is the visual source of truth for the WUWA LAB redesign. The redesign progress is tracked separately from the calculator's functional progress: it starts at 0% and reaches 100% only when all 20 steps below are complete.

## 1. Locked art direction

WUWA LAB should feel like a premium Wuthering Waves theorycraft companion rather than a generic SaaS dashboard or RGB gaming tool.

The visual reference supplied for the redesign establishes the following direction:

- **Primary surfaces:** warm ivory / parchment-like light surfaces rather than full-screen near-black panels.
- **Contrast surfaces:** deep charcoal / ink-black navigation, item cards and selected states.
- **Accents:** restrained antique gold / warm beige, with elemental colours used only where they carry gameplay meaning.
- **Borders:** thin, precise, slightly warm neutral lines; avoid thick rounded dashboard borders.
- **Shape language:** mostly rectangular and editorial, with small corner radii where useful; avoid oversized pill-shaped UI everywhere.
- **Texture:** subtle paper/grain/ink treatment is allowed as decoration, but must never reduce text or data readability.
- **Typography:** elegant editorial hierarchy for headings combined with highly readable compact text for statistics and controls.
- **Density:** information-dense but ordered. The interface should feel like a technical field guide / laboratory, not an empty landing page with oversized whitespace.
- **Illustration:** Resonator, weapon and Echo imagery will become part of the information architecture, not background decoration only.
- **Motion:** restrained and functional. No heavy neon glow, RGB effects or attention-seeking animation.

### Visual balance

The target balance is approximately:

- light editorial surfaces for page content and data panels;
- black/charcoal for global navigation, image-backed item cards, active selections and high-contrast modules;
- gold/beige for identity, separators and selected accents;
- gameplay-specific colours only for elements, Sonata identity, warnings and status semantics.

This is a **direction**, not a request to reproduce an official Wuthering Waves interface or any reference image pixel-for-pixel. WUWA LAB keeps its own identity and component system.

## 2. What must change from the current UI

The current dark teal/cyan dashboard presentation is considered legacy styling for the redesign. Existing functionality may remain during migration, but new visual work must not use it as the target aesthetic.

In particular, the redesign should remove or strongly reduce:

- full-screen black/blue backgrounds as the default content surface;
- cyan as the dominant brand colour;
- large generic rounded SaaS panels;
- excessive pill badges;
- oversized empty spacing around technical data;
- form controls that visually dominate the content;
- text-only equipment selection when images are available and useful;
- decorative glow as a primary means of hierarchy.

Existing teal/cyan code does **not** need to be deleted in Step 1. It will be replaced incrementally by the following steps.

## 3. Product principles

Every redesign decision should satisfy these principles, in order:

1. **Data remains readable first.** A DPS calculator is a technical tool; art direction must not hide values or state.
2. **Game imagery carries identity.** Resonator, weapon and Echo imagery should help recognition and navigation.
3. **Permanent and runtime state stay understandable.** Visual polish must not blur architecture boundaries or imply unsupported calculations.
4. **Dense does not mean cluttered.** Alignment, separators, type scale and grouping should do more work than oversized containers.
5. **The same visual grammar applies everywhere.** Character Box, Echoes, Personal DPS, Team DPS and Game Data must look like one product.
6. **Mobile is a reflow, not a different product.** Desktop is the primary composition, but important data and actions must remain usable on narrow screens.
7. **Local verified assets only.** Future illustrations use the promoted local asset registry / safe UI projections, not arbitrary external image URLs or fuzzy name matching.

## 4. Page-level visual targets

### Home

Editorial hero with WUWA LAB identity, restrained character artwork, compact database counters and dark navigation cards for the main modules.

### Character Box

The principal reference page for the visual language. A compact Resonator gallery, a large selected-character area, weapon presentation, permanent stats and build summary should coexist in a structured editorial layout.

### Echo editor

Five image-led Echo cards should be visible as a coherent loadout. Main Echo, total cost, Sonata composition, main stats and substats must be readable without turning the page into a wall of selects.

### Personal DPS

The result should lead visually: build identity, large DPS result, rotation duration / total damage, damage breakdown and timeline. Sandbox/diagnostic controls remain available but become secondary.

### Team DPS

Three character identities, team result, rotation timeline, active buffs and per-character contribution form the primary hierarchy.

### Game Data

A catalogue / compendium presentation with image-backed cards, compact filters and detailed information after selection.

## 5. Image integration boundary

Images are intentionally **not wired in Step 1**. Their integration starts only after the common visual foundations exist.

When image work begins:

- resolve images by stable promoted IDs;
- use local files managed by the existing GameAssetRegistry or a derived browser-safe projection;
- never infer an association from display names;
- do not expose RAW import data to the browser;
- provide deterministic fallbacks for missing or invalid imagery;
- optimise thumbnails separately from large selected-character artwork where practical.

## 6. Twenty-step redesign roadmap

Each completed step represents **5% of the visual redesign**.

- [x] **01 — Lock art direction.** Establish the reference language, non-goals and product principles in this document.
- [ ] **02 — Design tokens.** Define colour, surface, border, radius, shadow and spacing tokens.
- [ ] **03 — Typography system.** Define heading, body, stat, label and numeric hierarchy.
- [ ] **04 — Shared UI primitives.** Build panels, cards, buttons, tabs, fields, badges, stat rows, dividers and tooltips.
- [ ] **05 — Global shell.** Rebuild navigation, page frame and footer in the new language. **Checkpoint.**
- [ ] **06 — Background / texture system.** Implement restrained paper, grain and decorative treatment with accessibility/performance constraints.
- [ ] **07 — Illustrated card system.** Create reusable image-led cards for Resonators, weapons and Echoes.
- [ ] **08 — Safe UI asset projection.** Expose only the local stable-ID image mappings required by browser UI.
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

## 7. Checkpoint rule

Steps 5, 9, 13, 16 and 18 are explicit visual checkpoints. At those points, the next block should not be rushed if the direction is visibly wrong. Fixing the shared language at a checkpoint is preferred over carrying a weak pattern into later pages.

## 8. Architecture boundary during the redesign

The redesign is presentation work unless a step explicitly requires a safe UI projection. It must not silently change combat semantics.

In particular:

- `UserBuild.finalStats` remains the sole permanent-stat source consumed by runtime engines;
- the visual redesign must not rebuild permanent stats from weapon, Echo or Sonata data inside Damage / State / Temporal engines;
- unsupported or incomplete calculations must remain visibly distinguishable from verified results;
- external descriptions remain inert data and are never interpreted as executable logic.

---

**Visual redesign progress after Step 1: 5%.**
