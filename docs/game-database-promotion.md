# GameDatabase snapshot promotion

The reviewed GameDatabase generator intentionally writes to ignored `.tmp/` storage. A separate promotion workflow is responsible for publishing only the browser-safe generated catalog to the repository.

## Published file

The only generated data file promoted by this workflow is:

`public/data/wuwa/game-database-v1.json`

RAW Encore payloads, normalized source snapshots, field inventories, audit reports and importer quarantine files are never published by this workflow.

The public JSON is intended to be fetched as static data by the application rather than copied into hand-maintained character modules. Curated combat definitions remain separate and are not overwritten.

## Two-job trust boundary

`.github/workflows/game-database-promotion.yml` deliberately separates network acquisition from repository write permission.

### Build job

The build job has `contents: read` only. Before executing repository scripts it proves that the triggering branch is exactly current `main` plus one `.game-data-promotion-trigger` commit. It then:

1. installs the lockfile with lifecycle scripts disabled;
2. verifies npm signatures and the dependency audit;
3. re-runs importer/normalizer/hardening/readiness/generator/promotion security tests;
4. acquires current Encore Release data into ephemeral runner storage;
5. builds `GameDatabaseV1`;
6. independently scans the generated JSON;
7. uploads only `game-database-v1.json` and its SHA-256 as a short-lived artifact.

The job has no repository write permission.

### Promotion job

The promotion job has `contents: write`, but it never imports from Encore and contains no Encore API call. It starts from the exact same reviewed trigger branch, downloads only the sanitized artifact, verifies its file list and checksum, and re-runs the independent generated-database verifier.

Only after those checks does it copy the exact artifact bytes to `public/data/wuwa/game-database-v1.json`, remove the trigger file, verify that those are the only repository changes, and commit back to the `game-data-promotion/**` branch.

It never pushes to `main`. The resulting branch is reviewed through a normal pull request and the standard Security baseline before merge.

## Independent verifier

`scripts/verify-generated-game-database.mjs` has three fixed-path modes (`--generated`, `--artifact`, `--public`). It accepts no arbitrary path or URL.

It checks:

- regular-file and symlink/path boundaries;
- an 8 MiB input ceiling;
- valid UTF-8 JSON;
- bounded JSON depth, node count, arrays, object keys and text;
- dangerous keys such as `__proto__`, `prototype` and `constructor`;
- absence of HTTP(S) URLs and script-like strings;
- absence of executable-looking RAW keys such as `DamageList`, `Condition(s)` and `Formula`;
- manifest schema/provider/dataset/counts;
- unique canonical IDs and unique Encore IDs per entity family;
- exact Encore/en/Release source metadata and SHA-256 provenance;
- Echo costs limited to 1/3/4;
- all Echo Sonata references resolving to generated Sonata definitions.

The verifier deliberately does not interpret descriptions as game logic.

## Manual trigger policy

A promotion branch must be created directly from current `main`. Its only initial change is `.game-data-promotion-trigger` containing `release`, committed with the exact message `trigger game-data promotion`.

The workflow then materializes the generated database on that branch. GitHub Actions is not trusted to merge its own output; merge remains a separate reviewed step.

## Combat boundary

Publishing the catalog does not itself recalculate `UserBuild.finalStats`. Echo main stats, substats and permanent Sonata contributions belong to a later Build/Stat Resolver. Existing manual `finalStats` builds must not receive generated equipment values a second time.
