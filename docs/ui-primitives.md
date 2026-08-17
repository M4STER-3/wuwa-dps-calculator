# WUWA LAB shared UI primitives

Status: **Visual redesign Step 4 / 20**

This document defines the reusable presentation primitives introduced for the WUWA LAB visual redesign. They consume only the `--wuwa-*` design tokens and the typography roles established in Steps 2–3.

The primitives are intentionally presentation-only. They do not read or mutate builds, combat state, `finalStats`, game data, storage, or external content.

## Source files

- `src/components/ui/wuwa-ui.tsx`: typed React primitives.
- `src/app/ui-primitives.css`: shared visual rules.
- `src/app/globals.css`: imports the primitive stylesheet.

## Components

### `WuwaPanel`

Editorial surface container.

Supported tones:

- `paper`
- `paper-raised`
- `paper-muted`
- `ink`
- `ink-soft`

Use light paper surfaces for most technical content. Ink panels are reserved for selected/high-contrast modules and future image-led cards. `compact` reduces padding for dense data areas.

### `WuwaCard`

Semantic `article` surface using the same tone system as `WuwaPanel`, with `paper-raised` as its default. It is the generic content-card primitive for module summaries, result cards and future compact catalogue entries.

Step 7 will build the dedicated illustrated Resonator / weapon / Echo card system on top of this shared surface contract rather than mixing image behaviour into the generic Step 4 primitive.

### `WuwaButton`

Button variants:

- `primary`: ink action with light text;
- `secondary`: paper action with a warm border;
- `ghost`: quiet low-priority action;
- `danger`: destructive action only.

Sizes use the shared control-height scale. The primitive defaults to `type="button"` so placing it inside a form cannot accidentally submit that form.

### `WuwaBadge`

Compact status / metadata marker. Badges are intentionally rectangular and small, not oversized pills.

Tones:

- neutral
- gold
- success
- warning
- danger
- info
- inverted

Semantic tones should describe state. Gold is an identity/selection accent, not a generic success colour.

### `WuwaTabs` / `WuwaTab`

Accessible presentational tab strip using `role="tablist"`, `role="tab"`, and `aria-selected`. State ownership remains with the consuming feature.

The redesign uses a thin underline for active tabs rather than filled cyan pills.

### `WuwaField`, `WuwaInput`, `WuwaSelect`

`WuwaField` owns the visible label and optional hint/error text. Consumers should pass `htmlFor` and a matching control `id` whenever possible.

`WuwaInput` and `WuwaSelect` preserve all native input/select props. The redesign-specific visual size uses `controlSize`, deliberately avoiding collision with the native HTML `size` attribute.

Invalid controls should use `aria-invalid="true"`; errors shown by `WuwaField` use `role="alert"`.

### `WuwaStatRow`

Dense label/value row for permanent stats, damage summaries and other numeric data. Values use the data typography role with tabular numerals. `emphasis` is reserved for meaningful totals / selected values, not every row.

### `WuwaDivider`

Warm-neutral one-pixel separator. `inset` provides an indented divider where the visual grouping needs it.

### `WuwaTooltip`

Small CSS tooltip for concise supplementary explanations. Tooltip content is rendered through a text attribute (`data-tooltip`) and native `title`; it is not interpreted as HTML. The wrapper is keyboard-focusable so the CSS tooltip is available without a pointer.

Tooltips must not contain critical information required to complete an action. Important validation or calculation state remains visible in normal page content.

### `WuwaSectionHeader`

Shared editorial section heading with optional eyebrow, description and actions. This keeps title hierarchy, separators and action alignment consistent across Character Box, Echoes, DPS and Game Data.

## Accessibility rules

- Visible form labels are preferred over placeholder-only fields.
- Keyboard focus uses the warm `--wuwa-focus` token.
- Interactive primitives retain native button/input/select semantics.
- Reduced-motion preference disables primitive transitions.
- Semantic status colours are supplementary; text/state labels must continue carrying meaning.
- Tooltips are supplementary only.
- Disabled controls remain visibly different and preserve native disabled behaviour.

## Migration boundary

Step 4 does **not** automatically replace legacy `.lab-*` pages. The components are opt-in building blocks. Step 5 migrates the global shell to the new visual system, and later page steps replace feature layouts in controlled blocks.

This prevents a half-migrated page from inheriting new colours or spacing by accident.

## Architecture boundary

These primitives contain no game or combat logic. They must remain safe to reuse regardless of whether a feature is complete, partial, or a visual preview.

In particular:

- no primitive derives permanent statistics;
- no primitive reconstructs weapon, Echo or Sonata effects;
- no primitive writes `UserBuild.finalStats`;
- no primitive parses external descriptions or formulas;
- no primitive fetches remote images or remote data.
