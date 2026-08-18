# WUWA LAB V4 design system — Step 2

Status: **implemented, awaiting visual validation**

This step introduces the first production-ready V4 presentation layer without remapping legacy page styles.

## Scope

- light application canvas and white / tinted workspace surfaces;
- dark technical text hierarchy with compact metadata;
- restrained accessible blue primary accent plus a secondary violet role;
- semantic success / warning / danger / info colours independent from the brand accent;
- thin neutral borders and deliberately soft elevation;
- compact buttons, fields, tabs, badges and stat rows;
- image-ready selector items intended for Resonators, weapons and Echoes;
- native dialog styling;
- empty, notice, disabled and skeleton/loading states;
- keyboard focus, reduced-motion and forced-colours fallbacks;
- responsive grid/layout utilities.

## Migration boundary

The V4 system is opt-in through the `.v4-theme` scope. Existing Character Box, DPS and Data pages retain their current styles until their dedicated migration steps.

This prevents Step 2 from globally recolouring legacy UI or changing functional layout before visual approval.

## Asset boundary

Step 2 deliberately uses neutral placeholders only. It does not expose GameAssetRegistry, RAW imported data or remote URLs to browser UI.

Safe stable-ID image projection begins at Step 4. Real local asset presentation begins at Step 5.

## Visual checkpoint

Use:

`/visual-test/design-system`

The preview demonstrates typography, surfaces, controls, selector density, stat hierarchy, feedback states, loading and a Character Box-oriented composition without pretending to be the final Character Box.

## Architecture boundary

No Damage / State / Temporal Engine, Build Resolver, `UserBuild.finalStats`, Character Box persistence, Echo validation, GameDatabase, importer or asset-pipeline semantics are changed in this step.
