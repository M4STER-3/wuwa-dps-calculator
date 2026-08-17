# WUWA LAB global shell

Status: **Visual redesign Step 5 / 20 — checkpoint**

Step 5 applies the new WUWA LAB art direction to the product frame without prematurely restyling the feature pages that still use legacy dark/cyan layouts.

## Desktop composition

At desktop widths, the application now uses a persistent ink navigation rail on the left and a flexible workspace on the right.

The rail contains:

- the WUWA LAB identity mark;
- the compact `Theorycraft workspace` descriptor;
- numbered primary navigation entries;
- route-aware active state using a restrained antique-gold line/wash;
- the persistent `Calculs vérifiés uniquement` boundary reminder.

This intentionally moves away from the previous floating SaaS-style horizontal header and establishes a denser editorial/product-tool silhouette closer to the visual reference.

## Workspace context bar

The workspace begins with a thin warm-paper context bar. It uses light editorial surfaces, ink text and muted gold rather than cyan glow.

It is deliberately compact: it exists to frame the current workspace, not to compete with feature content.

## Mobile composition

Below the desktop breakpoint, the navigation rail becomes a compact sticky ink header with a native `details` menu. The same route-aware navigation links are reused rather than maintaining a second navigation model.

## Footer

The footer is now a warm muted-paper surface with ink typography. It keeps the independent/community status and data-safety wording visible without presenting it as a large promotional block.

## Migration boundary

Feature content is intentionally still rendered on the legacy dark content background at this checkpoint. This prevents partially migrated pages from producing white-on-ivory or dark-on-dark readability failures.

The planned sequence remains:

1. Step 6 introduces the restrained page background/texture system.
2. Step 7 defines the illustrated-card contract.
3. Steps 8–9 wire and prove safe local imagery.
4. Feature pages then migrate in their dedicated steps.

The global shell itself exclusively consumes the new `--wuwa-*` tokens and Step 3 typography roles.

## Accessibility

- active navigation uses `aria-current="page"`;
- mobile navigation keeps native `details` / `summary` interaction;
- navigation remains usable without imagery;
- route identity is expressed by text and structural state, not colour alone;
- reduced-motion preference removes navigation transitions;
- no critical data is hidden in hover-only UI.

## Architecture boundary

Step 5 changes presentation only. It does not touch combat engines, Build Resolver, Character Box persistence, Echo validation, asset import, generated game data, or `UserBuild.finalStats` semantics.

## Checkpoint verdict

The shell now establishes the intended product grammar: **ink navigation + warm paper framing + restrained gold hierarchy + dense rectangular composition**.

Feature pages are expected to look transitional inside this shell until their own redesign steps. That transitional state is intentional and should not be “fixed” by globally remapping legacy variables.

**Visual redesign progress after Step 5: 25%.**
