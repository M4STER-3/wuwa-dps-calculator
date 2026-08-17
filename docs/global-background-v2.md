# WUWA LAB V2 global background

Step 1 treats the user-approved parchment/ink artwork as an immutable visual asset.

Expected repository path:

`public/assets/ui/wuwa-lab-global-background.png`

Expected source properties:

- dimensions: `1672 × 941`
- source format: PNG
- file size: `2,677,021` bytes
- SHA-256: `750a0ffd388778935754e4ebcfdeaf4b3e708517c05cec2406151381bb190f9f`

The file must not be recoloured, regenerated, retouched, destructively cropped, or have navigation states painted into it. Later steps overlay real controls above the artwork.

The validation route is:

`/visual-test/background`

It renders the asset with `next/image`, `unoptimized`, and `object-fit: contain` so Step 1 can be judged without responsive cropping or image optimization changing the source presentation. Responsive production behaviour is intentionally deferred to Step 2.
