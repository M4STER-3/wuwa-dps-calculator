# WUWA LAB — browser-safe gameplay asset projection

Status: V4 Step 4 / 15 implementation checkpoint.

## Purpose

The verified asset manifest under `public/assets/wuwa/manifest.json` contains metadata that browser UI does not need. V4 therefore generates a smaller projection before every local/production UI build.

The browser projection contains only:

- category: `characters`, `weapons`, or `echoes`;
- stable promoted source ID as a value;
- manifest asset role;
- same-origin content-addressed local path.

It deliberately excludes display names, upstream URLs, source/API metadata, byte counts, MIME metadata, hashes as standalone fields, timestamps, and all RAW game-data content.

## Security boundary

Generation accepts only asset manifest schema V2 and requires exactly the three supported categories. Every projected path must match:

`/assets/wuwa/objects/<64 lowercase hex>.(png|jpg|webp)`

The manifest `sha256`, declared content type and local filename extension must agree before a mapping is promoted. Source IDs and roles are bounded, control-character-free and reject prototype-pollution keys.

The generated payload is canonically sorted and validates its own entity/asset counts. Duplicate entities or roles are rejected.

The output is build-generated at:

`/public/data/wuwa/ui-asset-projection-v1.json`

and is exposed same-origin through `/api/wuwa/ui-assets` as a redirect to that static file.

## Runtime contract

`src/game-data/ui-asset-projection.ts` validates any fetched payload before use. UI lookup is exact by:

1. category;
2. stable promoted ID;
3. an ordered list of accepted asset roles.

Display names must never be used to infer asset filenames or mappings.

## V4 usage

Step 4 only establishes this boundary. Step 5 will build reusable image presentation components and choose explicit role preferences for portrait, artwork, weapon, Echo and catalogue contexts.

No combat engine, Build Resolver, `UserBuild.finalStats`, Character Box persistence, Echo validation, imported description handling or GameDatabase value is modified by this projection.
