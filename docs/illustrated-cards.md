# WUWA LAB illustrated card system

Status: **Visual redesign Step 7 / 20**

Step 7 defines the reusable image-led presentation contract that will later receive safe local Resonator, weapon and Echo artwork. It deliberately introduces the visual structure before any browser asset mapping is exposed.

## Source

- `src/components/ui/wuwa-illustrated-card.tsx`
- `src/app/illustrated-card.css`
- exported from `src/components/ui/index.ts`

## Card kinds

The card contract has three explicit gameplay presentation kinds:

- `resonator`
- `weapon`
- `echo`

Kinds define only visual media proportions. They do not fetch data, infer IDs, resolve assets, inspect game databases, or apply combat semantics.

Default media proportions:

- Resonator: portrait-oriented `4 / 5`;
- weapon: wider `4 / 3`;
- Echo: square `1 / 1`.

These proportions may be refined during the Step 9 real-asset proof if actual promoted assets require different cropping.

## Density modes

### `gallery`

Compact dark/ink card intended for visual selectors and dense character/Echo grids. Identity remains readable below the media while the image area carries most of the recognition burden.

### `standard`

Paper-backed information card for equipment summaries and catalogue entries. Optional metadata rows remain visible.

### `feature`

Large layered card for selected Resonator / weapon / Echo presentations. The media and information sheet overlap slightly instead of forming a rigid 50/50 dashboard grid. On narrow screens it reflows to a stacked composition.

## Components

### `WuwaIllustratedCard`

Non-interactive article presentation.

### `WuwaIllustratedCardButton`

Native button version for selectors. It uses `aria-pressed` for selected state, defaults to `type="button"`, and preserves the native disabled contract.

`unavailable` also disables the interactive card and shows explicit text so disabled state is not represented by colour/opacity alone.

### `WuwaIllustratedCardGrid`

Responsive auto-fill grid helper. Consumers may provide a minimum card width; no fixed character count is encoded into the primitive.

## Media slot

The `media` property accepts a React node but Step 7 does not provide a resolver or URL contract.

When no media is provided, the component renders a deterministic local CSS fallback with an `R`, `W`, or `E` mark depending on kind. No placeholder file or external request is required.

Real imagery remains blocked until:

1. Step 8 creates a browser-safe stable-ID → local-asset projection;
2. Step 9 proves that projection against a small cross-category sample.

The card itself must never accept arbitrary source URLs as a data-resolution mechanism.

## Visual language

The cards follow the locked reference direction while avoiding a rigid dashboard silhouette:

- ink/charcoal media stage;
- thin warm borders rather than heavy framed boxes;
- clipped/asymmetric corner cuts instead of generic rounded rectangles;
- partial corner framing rather than a complete rectangle around artwork;
- a small information sheet that overlaps the lower media edge;
- feature cards built from layered planes rather than equal rectangular columns;
- restrained antique-gold rules and marks;
- paper surfaces for structured data;
- darker compact gallery mode;
- selected state expressed by a warm rule/border plus a visible marker;
- metadata grouped with a single editorial rule instead of repeated boxed rows;
- no neon cyan glow;
- no oversized pill treatment;
- no animated background or game-like RGB effect.

The intended result is more editorial and slightly irregular while remaining precise enough for a technical calculator. Decorative asymmetry must never make values harder to scan.

## Metadata

Cards may show:

- eyebrow/category text;
- title;
- subtitle;
- compact corner label such as a level/cost in later consumers;
- badges supplied by normal shared UI primitives;
- label/value metadata rows;
- optional feature-card footer.

The primitive does not decide which game fields belong there. Feature code owns the meaning of each field.

## Accessibility and resilience

- selectable cards retain native button semantics;
- selected state uses `aria-pressed` and a visible non-colour marker;
- unavailable state is explicit text and native disabled state;
- keyboard focus uses `--wuwa-focus`;
- title remains text even when imagery becomes available;
- reduced-motion removes hover translation;
- higher-contrast mode removes decorative shade/shadow;
- forced-colours mode removes decorative clipping/framing and restores system colours;
- media imagery can never be the only source of identity.

## Generated-art boundary

Generated decorative imagery is not required to achieve the target shape language. Geometry, overlap, borders, hierarchy and colour are implemented in CSS/components first.

If custom generated artwork is introduced later, it should be limited to optional brand ornamentation or original non-game decorative motifs. Actual Resonator, weapon and Echo identity images continue to come from the verified local asset pipeline.

## Architecture boundary

Step 7 is presentation only.

It does not:

- access `GameAssetRegistry`;
- expose imported RAW data;
- build a browser asset manifest;
- fetch external images;
- derive Resonator/weapon/Echo identity from names;
- modify Character Box persistence;
- resolve Echo stats;
- calculate `finalStats`;
- touch Damage, State, Temporal, or Build Resolver semantics.

**Visual redesign progress after Step 7: 35%.**
