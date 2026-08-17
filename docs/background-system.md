# WUWA LAB background and texture system

Status: **Visual redesign Step 6 / 20**

The Step 6 background system gives WUWA LAB its warm editorial paper / ink atmosphere without introducing raster texture assets, remote resources, animated grain, or content-dependent styling.

## Source

- `src/app/background-system.css`
- loaded globally after the base shell styles from `src/app/layout.tsx`

## Visual roles

The system exposes reusable static roles:

- `.wuwa-bg-paper-canvas`: warm ivory page canvas with restrained light falloff and fine fibre lines;
- `.wuwa-bg-paper`: normal paper surface;
- `.wuwa-bg-paper-raised`: brighter editorial surface;
- `.wuwa-bg-paper-muted`: subdued parchment grouping surface;
- `.wuwa-bg-ink`: high-contrast charcoal/ink surface with restrained warm light and grain;
- `.wuwa-bg-ink-soft`: secondary ink surface;
- `.wuwa-editorial-rule`: thin warm vertical rule for future editorial grouping without another oversized card.

The texture recipes themselves are CSS gradients stored as `--wuwa-paper-*` and `--wuwa-ink-*` custom properties.

## Step 6 shell application

The background system is first applied to the already-migrated global shell:

- the site root uses the warm canvas colour;
- the workspace context bar receives subtle paper fibre and warm directional tint;
- the footer receives muted paper fibre;
- desktop rail and mobile header receive restrained ink grain / warm illumination;
- the still-legacy dark feature content receives only a shallow warm transition at its top edge so the shell/content boundary looks intentional.

Feature pages are **not** globally converted to paper surfaces in Step 6. They are migrated during their dedicated roadmap steps so existing white/cyan legacy text cannot lose contrast.

## Performance constraints

- no PNG/JPEG/WebP/SVG texture file;
- no data URI texture;
- no network request;
- no animated grain;
- no JavaScript texture generation;
- no fixed full-screen blur layer;
- gradients are static and reusable through CSS variables.

This keeps the visual treatment lightweight and makes it available before the real game imagery pipeline begins at Step 8.

## Accessibility constraints

Texture is decoration only and never carries information.

When `prefers-contrast: more` or `forced-colors: active` is enabled:

- texture background images are removed;
- decorative transition gradients are removed;
- editorial decorative rules are removed.

Text, borders, controls and semantic statuses remain independently readable without the texture layer.

## Image boundary

Step 6 does not implement Resonator, weapon, or Echo artwork. The current roadmap remains:

- Step 7: illustrated-card layout contract without real game imagery;
- Step 8: safe stable-ID → local asset UI projection;
- Step 9: first real cross-category image rendering proof.

## Architecture boundary

The background system is presentation-only. It has no access to builds, storage, imported source data, the asset registry, combat engines, or `UserBuild.finalStats`.
