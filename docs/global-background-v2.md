# WUWA LAB V2 global background

Step 1 treats the user-approved parchment/ink artwork as an immutable visual asset.

Expected repository path:

`public/assets/ui/wuwa-lab-global-background-4k.png`

Expected source properties:

- dimensions: `3840 × 2160`
- source format: PNG
- file size: `7,593,171` bytes
- SHA-256: `950d2ce6914de7c23493e96b19e9985fedb833d36a40d35517176ef292eb1b82`

The file must not be recoloured, regenerated, retouched, destructively cropped, or have navigation states painted into it. Later steps overlay real controls above the artwork.

The validation route is:

`/visual-test/background`

It renders the asset with `next/image`, `unoptimized`, and `object-fit: contain` so Step 1 can be judged without responsive cropping or image optimization changing the source presentation. Responsive production behaviour is intentionally deferred to Step 2.
