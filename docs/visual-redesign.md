# WUWA LAB visual redesign

Status: **Step 4 / 20 — shared UI primitives defined**

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

Existing teal/cyan code does **not** need to be deleted immediately. It is replaced incrementally by the following steps.

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

Images are intentionally **not wired in Steps 1–7**. Their browser-safe integration begins at Step 8, after the visual foundations and illustrated-card contract exist.

Image implementation sequence:

- **Step 8:** create the safe UI asset projection from stable promoted IDs to local assets;
- **Step 9:** prove image rendering with a small cross-category sample of Resonators, weapons and Echoes;
- **Step 11:** integrate real Resonator portraits/artwork into Character Box;
- **Step 12:** integrate real weapon imagery into Character Box and weapon selection;
- **Step 15:** integrate real Echo imagery into the five-slot Echo editor;
- **Steps 17–19:** reuse the established imagery system in Home, DPS surfaces and Game Data.

When image work begins:

- resolve images by stable promoted IDs;
- use local files managed by the existing GameAssetRegistry or a derived browser-safe projection;
- never infer an association from display names;
- do not expose RAW import data to the browser;
- provide deterministic fallbacks for missing or invalid imagery;
- optimise thumbnails separately from large selected-character artwork where practical.

## 6. Design token contract

Step 2 introduces the `--wuwa-*` token namespace in `src/app/globals.css`. These variables are the new visual foundation, but are deliberately **not yet mapped onto the legacy dark/cyan aliases**. That migration happens through the shared primitives and global shell in Steps 4–5, avoiding a half-redesigned production UI.

### Surfaces

- `--wuwa-canvas`: warm page background.
- `--wuwa-surface-paper`: standard editorial panel.
- `--wuwa-surface-paper-raised`: higher-contrast light surface.
- `--wuwa-surface-paper-muted`: subdued light grouping surface.
- `--wuwa-surface-ink`: primary black/charcoal contrast surface.
- `--wuwa-surface-ink-soft`: secondary dark surface.
- `--wuwa-surface-ink-raised`: elevated dark card surface.

### Text and accent

- ink text is separated into primary, muted and faint levels;
- on-ink text has dedicated primary and muted values;
- antique gold has standard, strong, soft and translucent wash variants;
- gameplay element colours are **not** encoded as brand tokens and remain reserved for gameplay meaning.

### Lines and states

Thin warm-neutral borders have soft, standard, strong and on-ink variants. Semantic success, warning, danger and info colours are intentionally muted so status does not become RGB decoration. A warm focus token is reserved for accessible keyboard focus during the component migration.

### Shape and depth

Radii are intentionally restrained: `0`, `2px`, `4px`, `8px`, `12px`. The system must not drift back toward oversized rounded SaaS panels. Shadows are subtle and warm on paper, with a separate restrained dark-card shadow.

### Spacing and sizing

The spacing scale is fixed from `4px` through `64px`, with `24px` as the current desktop page gutter and `1800px` as the maximum wide workspace. Control-height tokens provide compact `32px`, standard `38px` and prominent `44px` variants.

### Migration rule

New redesign components should consume `--wuwa-*` tokens directly. Existing `--background`, `--panel`, `--accent`, and related legacy variables remain temporary compatibility aliases only and should not be used by new redesign primitives.

## 7. Typography contract

Step 3 adds `src/app/typography.css` and imports it from the global stylesheet. The typography system is intentionally opt-in until the shared primitives and global shell migrate in Steps 4–5.

### Font roles

- `--wuwa-font-display`: a system serif stack used for editorial hero titles, page titles, section headings and very large DPS/result numbers.
- `--wuwa-font-ui`: the native system sans-serif stack used for body copy, controls, navigation, labels and dense technical information.
- `--wuwa-font-data`: a stable sans-serif data stack used for statistics and numeric tables with tabular numerals.

No external font download or hosted font dependency is introduced in Step 3. This keeps rendering deterministic, avoids layout shifts and keeps the redesign independent from third-party font delivery.

### Hierarchy

The system defines dedicated scales for:

- hero identity;
- page titles;
- section headings;
- card titles;
- body copy;
- controls;
- uppercase labels and eyebrows;
- small/micro metadata;
- hero DPS/results;
- large and medium statistics.

Display text uses tighter tracking and restrained line height. Technical UI text uses compact but readable line height. Labels/eyebrows use intentional uppercase tracking rather than oversized font weight.

### Numeric rule

DPS values, statistics and table-oriented data use `tabular-nums` and `lining-nums` through the typography primitives. Large result numbers may use the display serif for visual hierarchy, but values in dense tables and stat rows remain in the data stack for alignment and scanning.

### Utility primitives

Step 3 exposes opt-in classes including:

- `.wuwa-type-hero`;
- `.wuwa-type-page-title`;
- `.wuwa-type-section`;
- `.wuwa-type-card-title`;
- `.wuwa-type-body`;
- `.wuwa-type-control`;
- `.wuwa-type-label` / `.wuwa-type-eyebrow`;
- `.wuwa-type-stat-hero`, `.wuwa-type-stat-lg`, `.wuwa-type-stat-md`;
- `.wuwa-type-data`.

These classes intentionally do **not** impose redesign colours or surfaces. Step 4 composes them with the new visual tokens inside reusable components.

## 8. Shared UI primitive contract

Step 4 introduces typed React primitives in `src/components/ui/wuwa-ui.tsx` and their shared styles in `src/app/ui-primitives.css`. Their detailed API and accessibility rules are documented in `docs/ui-primitives.md`.

The initial shared set includes:

- paper / ink panels;
- primary, secondary, ghost and destructive buttons;
- compact semantic badges;
- tablist / tab presentation;
- labelled fields plus native input and select wrappers;
- dense numeric stat rows;
- warm-neutral dividers;
- keyboard-accessible supplementary tooltips;
- reusable editorial section headers.

### Primitive rules

- primitives consume `--wuwa-*` tokens instead of legacy cyan variables;
- primitive typography uses the Step 3 roles rather than page-local font sizes;
- buttons default to `type="button"` to avoid accidental form submission;
- input/select visual sizing uses `controlSize` so native HTML `size` remains available;
- badges remain compact and rectangular rather than becoming large pills;
- semantic state colours supplement text and never carry meaning alone;
- tooltips contain supplementary text only and never critical validation;
- reduced-motion preference removes primitive transitions;
- no primitive contains game, persistence, remote-data or combat logic.

The primitives remain opt-in in Step 4. Existing `.lab-*` pages are not globally recoloured yet. Step 5 is the first controlled migration of the shared site shell.

## 9. Twenty-step redesign roadmap

Each completed step represents **5% of the visual redesign**.

- [x] **01 — Lock art direction.** Establish the reference language, non-goals and product principles in this document.
- [x] **02 — Design tokens.** Define colour, surface, border, radius, shadow and spacing tokens.
- [x] **03 — Typography system.** Define heading, body, stat, label and numeric hierarchy.
- [x] **04 — Shared UI primitives.** Build panels, cards, buttons, tabs, fields, badges, stat rows, dividers and tooltips.
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

## 10. Checkpoint rule

Steps 5, 9, 13, 16 and 18 are explicit visual checkpoints. At those points, the next block should not be rushed if the direction is visibly wrong. Fixing the shared language at a checkpoint is preferred over carrying a weak pattern into later pages.

## 11. Architecture boundary during the redesign

The redesign is presentation work unless a step explicitly requires a safe UI projection. It must not silently change combat semantics.

In particular:

- `UserBuild.finalStats` remains the sole permanent-stat source consumed by runtime engines;
- the visual redesign must not rebuild permanent stats from weapon, Echo or Sonata data inside Damage / State / Temporal engines;
- unsupported or incomplete calculations must remain visibly distinguishable from verified results;
- external descriptions remain inert data and are never interpreted as executable logic.

---

**Visual redesign progress after Step 4: 20%.**
