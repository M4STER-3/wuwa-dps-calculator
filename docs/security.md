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
- cross-origin opener isolation is enabled;
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

The future game-data importer must use an explicit endpoint allowlist under the reviewed Encore API origin, HTTPS only, Release data only, disabled redirects, strict JSON content type, streaming size limits, timeouts, schema validation, semantic validation, dangerous-key rejection, atomic writes and a fail-closed update policy.

A raw download is quarantine input. It becomes generated game data only after validation and normalization.

Missing remote entities produce warnings/reviewable diffs; they are never automatically deleted from the last known-good database.

## Assets

The existing asset synchronizer already constrains source hosts, response size, MIME type, binary signatures, paths and content hashes. Before unattended synchronization is enabled, it should additionally receive:

- reviewed allowlists for accepted image roles/field paths instead of relying only on broad image-name detection;
- rejection of advertising/tracking/promotional fields even when hosted on an otherwise accepted origin;
- symlink-aware filesystem containment checks;
- explicit tests for malformed manifests, path traversal and hostile payload shapes.

Assets remain content-addressed by SHA-256 and are resolved through a manifest rather than embedding remote URLs in runtime game data.

## CI and supply chain

Security CI runs with read-only repository permissions by default. Third-party GitHub Actions are pinned to full commit SHAs. Checkout does not persist repository credentials.

Dependency installation in validation CI uses the lockfile and disables lifecycle scripts. Production dependencies are audited for high-severity advisories, and pull requests receive dependency review.

Future automated Encore imports must run in a separate job/workflow with no deployment secrets and no write permission to `main`. Their output should become a reviewable pull request only after validation.

## Future authentication

If accounts are introduced later:

- authentication/session tokens must not be stored in `localStorage`;
- use secure, HttpOnly, SameSite cookies or an equivalent server-side session design;
- add CSRF protections to state-changing routes;
- rate-limit authentication and mutation endpoints;
- keep Cloudflare and deployment credentials in encrypted secret bindings, never repository configuration.

## Security rollout rule

Security controls should fail closed for untrusted data, but deployment-level controls such as CSP/HSTS must be rolled out in a way that does not accidentally make the legitimate site unusable. HSTS preload, strict nonce CSP, cross-origin embedder isolation and authentication policies require a separate compatibility review before being strengthened.
