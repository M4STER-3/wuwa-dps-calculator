# Security model

This project treats browser input, browser storage, remote APIs, remote images, generated data, dependencies, and CI metadata as untrusted until validated.

## Visitor threat model

A visitor should not need to trust Encore.moe or another third-party service while using the deployed calculator. The browser-facing application should operate from repository/deployment-owned data and assets.

Primary browser risks:

- XSS or DOM injection executing attacker-controlled JavaScript;
- clickjacking through hostile framing;
- unexpected outbound browser requests leaking referrer or application data;
- MIME confusion causing data to be interpreted as executable content;
- malicious or compromised JavaScript dependencies shipped in the application bundle;
- untrusted/corrupted `localStorage` data reaching internal domain objects;
- future authentication/session data being stored somewhere JavaScript can read it;
- cross-origin window/resource leaks;
- transport downgrade or mixed-content mistakes.

Current baseline:

- global Content Security Policy restricts scripts, network connections, images, forms, frames and objects;
- framing is denied by both CSP and `X-Frame-Options`;
- MIME sniffing is disabled;
- referrer information is reduced cross-origin;
- unused sensitive browser capabilities are disabled with `Permissions-Policy`;
- cross-origin opener and resource isolation are enabled;
- production HSTS starts with a deliberately short max-age and no preload;
- the Next.js `X-Powered-By` header is disabled;
- lint blocks `eval`, implied eval, `Function` construction, `javascript:` URLs and `dangerouslySetInnerHTML`;
- Character Box persistence is bounded, validated and reconstructed from known fields before use.

The CSP currently permits inline Next.js script elements because this application remains compatible with static rendering. Removing that allowance requires a separately validated nonce- or hash-based strategy and must not be done by silently forcing all routes to dynamic rendering.

## Remote data and Encore

Encore is a data source, never a code source.

Remote data must never be:

- executed;
- imported as JavaScript/TypeScript;
- passed to `eval`, `Function`, shell commands or package managers;
- allowed to choose arbitrary network destinations;
- allowed to choose filesystem paths;
- allowed to add dependencies;
- allowed to modify application/runtime/CI/deployment code.

The RAW game-data importer enforces an explicit character/weapon/Echo endpoint allowlist under `https://api-v2.encore.moe`, HTTPS only, English Release data only, disabled redirects, strict JSON content type, streaming response and total-transfer limits, timeouts, UTF-8/JSON validation, dangerous-key rejection, bounded collections/IDs and a fail-closed promotion policy.

List and detail URLs are constructed exclusively by project code. URLs embedded inside an Encore response are never followed by the data importer. Payload strings therefore cannot redirect the importer toward advertisements, tracking endpoints, downloads or arbitrary hosts.

A raw download remains quarantine input until every list and detail request in the run has succeeded. Only `.json` files can be promoted, and detail filenames are SHA-256-derived rather than source-controlled filesystem paths. Promotion uses a staged directory swap; a failure leaves the last known-good RAW snapshot authoritative.

If a previously known character, weapon or Echo disappears from the source, promotion is blocked rather than deleting it automatically.

The manual `Encore import audit` workflow has read-only repository permissions and no deployment secrets. It runs the mocked attack regressions before contacting Encore and uploads only the safe manifest/schema report, not RAW source payloads. Normalized field mappings are intentionally deferred until that real Release schema report has been reviewed.

## Assets

The asset synchronizer constrains source hosts, response size, MIME type, binary signatures, paths and content hashes. Normal npm asset-sync commands pass through a safety wrapper that:

- accepts only the reviewed `--dry-run` and `--force` flags;
- verifies that the synchronizer and existing manifest are regular files rather than symbolic links;
- creates the output tree without using a shell;
- rejects symbolic links in the repository-to-output directory chain and object store;
- resolves the final output directory and verifies that it still lives inside the repository before launching the network synchronizer.

The network synchronizer additionally:

- uses HTTPS and the exact reviewed Encore API origin for JSON requests;
- refuses redirects, credentials, custom ports and URL fragments;
- accepts only PNG/JPEG/WebP with matching MIME type and binary signature;
- bounds each response, the total remote bytes read per run, total discovered assets, traversal depth/nodes, entity counts and image fields per entity;
- rejects dangerous object keys such as `__proto__`, `constructor` and `prototype`, duplicate stable IDs and manifest records that do not exactly match the content-addressed object format;
- ignores advertising, sponsored, tracking and promotional image-field paths even when their URL points to an otherwise allowed Encore host;
- writes content-addressed SHA-256 objects atomically and keeps the last successful manifest authoritative when a non-budget asset download fails.

Security regression tests exercise a normal mocked synchronization, hostile object IDs, malformed image bytes, unsupported command-line arguments, symbolic-link attacks and a deliberately invalid promotional image that must never be downloaded. These tests run in CI without contacting Encore.

Before unattended synchronization is enabled, accepted image roles/field paths should still be tightened from broad image-name detection toward reviewed role allowlists as the Encore schema is mapped.

Assets remain content-addressed by SHA-256 and are resolved through a manifest rather than embedding remote URLs in runtime game data.

## CI and supply chain

Security CI runs with read-only repository permissions by default. Third-party GitHub Actions are pinned to full commit SHAs. Checkout does not persist repository credentials.

Dependency installation in validation CI uses the lockfile and disables lifecycle scripts. CI verifies npm registry signatures/provenance, audits all installed dependencies for high-severity advisories, validates both asset and game-data importer security scripts/attack tests, runs lint/typecheck/application tests, builds Next.js, smoke-tests the production security headers, builds the OpenNext/Cloudflare Worker and validates a Wrangler dry-run deployment bundle.

Pull requests use GitHub Dependency Review when the repository exposes the dependency-graph comparison API. If that GitHub capability is unavailable, CI emits an explicit warning instead of pretending the review ran.

Dependabot checks npm and GitHub Actions dependencies on a schedule, but updates are reviewable pull requests rather than automatic merges.

Any future automated Encore update that writes repository content must remain separate from deployment credentials and must create reviewable changes rather than pushing directly to `main`.

## Future authentication

If accounts are introduced later:

- authentication/session tokens must not be stored in `localStorage`;
- use secure, HttpOnly, SameSite cookies or an equivalent server-side session design;
- add CSRF protections to state-changing routes;
- rate-limit authentication and mutation endpoints;
- keep Cloudflare and deployment credentials in encrypted secret bindings, never repository configuration.

## Security rollout rule

Security controls should fail closed for untrusted data, but deployment-level controls such as CSP/HSTS must be rolled out in a way that does not accidentally make the legitimate site unusable. HSTS preload, strict nonce CSP, cross-origin embedder isolation and authentication policies require a separate compatibility review before being strengthened.
