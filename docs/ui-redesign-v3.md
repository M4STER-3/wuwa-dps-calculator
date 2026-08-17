# WUWA LAB visual redesign V3 — coded interface

Status: **Phase 1 — shell + Home visual checkpoint**

## Why V3 exists

The previous visual experiments introduced two directions that are now retired as product targets:

- the ivory / ink / restrained-gold editorial system;
- the image-first V2 based on one large 4K parchment/ink background.

V3 intentionally returns the product frame to code. A global illustration must never be required for the layout to work. React components and CSS own the hierarchy, responsive behaviour, accessibility and interaction states.

The existing calculator architecture remains authoritative. This redesign is presentation work.

## Audit summary

### Preserve

- Next.js App Router structure and current routes.
- Character Box persistence and its browser storage contract.
- `UserBuild.finalStats` as the only permanent-stat source consumed by runtime engines.
- Existing Echo validation / resolver contracts.
- Existing promoted local gameplay assets and safe image projections.
- Existing Damage / State / Temporal engine boundaries.
- Existing game data and security rules: external text stays inert and non-executable.
- Existing functionality even when its current interface is temporary.

### Replace progressively

- the old beige / black / gold visual target;
- the old cyan-on-black dashboard target;
- the 4K global-background concept as a production shell;
- the current desktop sidebar as the primary frame;
- repeated generic rounded dashboard cards;
- oversized controls and form-first layouts;
- the top-level Echo navigation entry.

The `/echoes` route may remain temporarily for compatibility while its functionality is later recomposed inside Character Box. It is not part of the final primary navigation.

## Art direction — “Spectral Mineral”

WUWA LAB should feel like a high-end analysis instrument built inside the Wuthering Waves universe, not like an enterprise admin panel and not like a neon gaming overlay.

### Palette

- near-black graphite canvas;
- deep indigo / mineral-blue surfaces;
- restrained spectral violet as the primary brand accent;
- muted jade as a secondary semantic accent;
- warm near-white text for long-session comfort;
- amber / coral reserved for warnings and destructive states.

The palette is deliberately neither beige/gold nor cyan/black.

### Shape language

- thin technical rules and partial frames;
- low-radius or clipped-corner surfaces rather than large soft pills;
- asymmetrical emphasis where useful;
- layered depth through value contrast before shadows;
- no container inside container unless it conveys a real hierarchy.

### Texture and atmosphere

All global atmosphere is CSS-generated: restrained grids, resonance rings, gradients and line work. There is no large site-wide image. Gameplay images remain real content inside cards and feature areas.

### Typography

- compact, high-contrast sans-serif display treatment for titles;
- tabular numerals for data;
- small uppercase technical labels used sparingly;
- readable body copy with comfortable line-height.

## Information architecture

Primary navigation contains only:

1. Accueil
2. Character Box
3. DPS personnel
4. DPS équipe
5. Données

Echo management belongs to Character Box.

## Phase 1 implementation

This branch is intentionally a visual checkpoint before the feature pages are rebuilt.

It includes:

- reusable V3 CSS tokens;
- reusable UI primitives for surfaces, buttons, badges, metrics, tabs, fields, tooltips, skeletons and state panels;
- a new responsive global shell with horizontal desktop navigation and real mobile reflow;
- a new Home page that demonstrates the visual language with database metrics, module hierarchy, a featured local Resonator image when available, and a denser non-SaaS composition;
- removal of the old global background-system import from the production layout.

Character Box, DPS and Data retain their current functional implementations until the visual direction is approved.

## Accessibility baseline

- native interactive elements whenever possible;
- visible `:focus-visible` states;
- minimum practical touch targets;
- contrast-first text hierarchy;
- reduced-motion handling;
- layout reflow rather than scale-down on narrow screens;
- decorative CSS layers hidden from assistive technology.

## Architecture guardrails

The redesign must not alter combat semantics.

- `UserBuild.finalStats` remains the permanent-stat runtime input.
- Damage / State / Temporal engines never reconstruct permanent stats from weapon, Echo or Sonata selections.
- Character Box persistence remains intact.
- Exact Echo validation remains intact.
- Game values are not modified for visual convenience.
- External text remains data, never executable logic.
