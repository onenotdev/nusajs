# Security and Privacy Product Requirements Document

## 1. Purpose

This document defines the security requirements for `[FRAMEWORK_NAME]`, its official packages, generated applications, development tooling, adapters, plugin contracts, release process, and documentation.

Security is a release requirement, not an optional feature. The framework cannot guarantee that every application is secure, but it must provide safe defaults, prevent framework-level vulnerability classes, make unsafe behavior explicit, and give application teams testable security primitives.

Subject to the Master PRD, this document takes precedence over product principles and subsystem PRDs for security and privacy decisions.

## 2. Security objectives

### SO-01 — Preserve trust-boundary integrity

Data from browsers, networks, plugins, filesystems, caches, environment variables, and deployment platforms remains untrusted until validated at the correct boundary.

### SO-02 — Prevent cross-request and cross-user data exposure

Request state, cached responses, loader data, errors, logs, and serialized payloads may not leak across users or requests.

### SO-03 — Minimize attack surface

Core has a small dependency graph, client runtime is omitted when unused, development interfaces are absent from production, and optional capabilities live in plugins.

### SO-04 — Fail safely

Invalid or unsupported security configuration fails closed. Framework behavior must not silently downgrade protection.

### SO-05 — Make risk visible

Unsafe escape hatches, public caching of personalized responses, network-exposed development servers, secret-to-client imports, and untrusted HTML usage produce visible diagnostics.

### SO-06 — Support timely response

The project maintains vulnerability reporting, supported-version policy, advisories, patch releases, dependency monitoring, and incident procedures.

## 3. Scope

In scope:

- Compiler and build pipeline.
- Route parsing and URL handling.
- Server and client runtimes.
- Rendering, hydration, streaming, and serialization.
- Loaders, actions, endpoints, and server functions.
- Cache keys, response caching, and invalidation.
- Development server, HMR, overlay, and inspector.
- Official adapters and plugins.
- Environment variables, secret boundaries, logs, traces, and errors.
- Package publishing, dependencies, release artifacts, and documentation.

Out of scope but documented as application responsibilities:

- Application-specific authorization policy.
- Identity proofing and account recovery.
- Business fraud detection.
- Database permissions and infrastructure configuration outside adapter contracts.
- Security of third-party plugins beyond framework compatibility checks.

## 4. Protected assets

- Application and framework source code.
- Environment secrets, API keys, signing keys, and credentials.
- Authentication tokens, cookies, sessions, and CSRF tokens.
- Personal and business data handled by applications.
- Server memory and request-local state.
- Cache entries and cache invalidation channels.
- Build artifacts, manifests, source maps, and package provenance.
- Developer workstations and development-server access.
- Plugin, adapter, and dependency supply chain.
- Availability of applications and build systems.
- Integrity of routes, responses, generated code, and release packages.

## 5. Threat actors

- Unauthenticated remote attacker.
- Authenticated malicious user.
- Cross-site attacker controlling another origin.
- Attacker controlling request headers, URLs, bodies, uploads, or serialized data.
- Compromised or malicious dependency, plugin, adapter, or build script.
- Misconfigured developer or operator.
- Attacker on the same local or shared network as an exposed development server.
- Insider or CI actor with excessive secret access.
- Automated resource-exhaustion attacker.

## 6. Trust boundaries

| Boundary | Untrusted side | Trusted side | Required controls |
|---|---|---|---|
| Browser to server | URL, headers, cookies, body | request pipeline | normalization, size limits, validation, CSRF/origin, authz hooks |
| Server to browser | loader data, errors, HTML | DOM/client runtime | escaping, safe serialization, CSP support, redaction |
| Plugin to build | npm package code | compiler/filesystem/secrets | trusted-code warning, constrained APIs, output roots, provenance review |
| Adapter to host | framework manifest | runtime platform | schema versioning, capability checks, secure defaults |
| App to cache | key/value/tags | shared cache | namespacing, tenant/user isolation, key validation, safe invalidation |
| Environment to client graph | secrets | browser bundle | static taint checks, explicit public schema, build failure |
| Dev browser to dev server | HMR/RPC messages | local tooling | loopback default, origin/session checks, message limits |
| Filesystem to route/assets | project files and symlinks | compiler/dev server | allowed roots, canonicalization, traversal and symlink protection |
| Logs/traces to sink | request metadata | external provider | redaction, allowlisted fields, cardinality control |
| Release artifact to consuming application | published package contents and their transitive dependencies | the installing application's build, runtime, and developer machine | provenance attestation, package-content review, lockfile integrity, no install scripts, license disclosure |

## 7. Security requirement classification

- `P0`: release blocker; compromise could expose data, execute code, bypass trust boundaries, or affect many applications.
- `P1`: must be complete before the applicable beta/stable milestone unless an accepted-risk record documents an owner, deadline, rationale, and compensating controls; significant hardening or abuse prevention.
- `P2`: defense in depth or ecosystem improvement.

Requirements use IDs `SEC-*`. Every P0 requirement must map to an automated test, a reproducible manual gate, or an accepted risk before release.

## 8. Input handling and URL security

### SEC-INPUT-001 [P0]

All route parameters, query values, headers, cookies, form fields, JSON bodies, and server-function inputs are untrusted. Framework APIs must make runtime validation straightforward and may not imply that TypeScript types provide runtime validation.

### SEC-INPUT-002 [P0]

Adapters and server runtime enforce configurable limits for URL length, header count and size, body size, multipart parts, serialization depth, and response buffering. Defaults must be conservative and documented.

### SEC-INPUT-003 [P0]

URL normalization behavior is identical across official adapters for percent encoding, dot segments, duplicate slashes, Unicode, malformed escape sequences, and path separators.

### SEC-INPUT-004 [P0]

Filesystem access may never concatenate untrusted URL paths. Canonicalized paths must remain inside allowed roots after resolving symlinks according to documented policy.

### SEC-INPUT-005 [P1]

Regular expressions and route matchers must resist catastrophic backtracking and pathological input. Route complexity and recursion have explicit limits.

Verification: malicious URL corpus, property tests, adapter conformance, path traversal fixtures, and resource-exhaustion tests.

## 9. Rendering, XSS, and serialization

### SEC-XSS-001 [P0]

Text interpolation is escaped by default according to HTML context. Raw HTML requires an explicitly unsafe API name and a development warning.

### SEC-XSS-002 [P0]

Serialized data embedded in HTML cannot terminate its container, create executable markup, alter surrounding script semantics, or trigger prototype pollution.

### SEC-XSS-003 [P0]

Attributes, URLs, styles, and script contexts use context-aware handling. The framework must not claim to sanitize arbitrary HTML; sanitization is provided by audited integrations.

### SEC-XSS-004 [P0]

CSP nonces and hashes are request-local, propagated without global mutable state, and applied consistently to framework-generated scripts.

### SEC-XSS-005 [P1]

Hydration and streamed payloads use opaque identifiers and reject unexpected message shapes, duplicate IDs, dangerous prototypes, and unsupported serialized values.

### SEC-XSS-006 [P1]

Production hydration mismatch and error recovery must not inject unescaped server or client content into diagnostics.

Verification: XSS polyglot corpus, script-breakout corpus, CSP browser suite, prototype-pollution tests, concurrent nonce isolation, and DOM-based regression tests.

## 10. Request forgery, origins, and redirects

### SEC-REQ-001 [P0]

Cookie-authenticated actions and server functions receive CSRF protection by default. The design combines a framework-approved token or same-site mechanism with origin validation appropriate to the deployment model.

### SEC-REQ-002 [P0]

State-changing operations reject unsupported content types and unsafe cross-origin requests unless CORS and CSRF behavior are explicitly configured.

### SEC-REQ-003 [P0]

Redirect helpers prevent open redirects by default. External destinations require an explicit allowlist or unsafe override.

### SEC-REQ-004 [P0]

Host and forwarded-host values are validated. Proxy headers are ignored unless a trusted-proxy policy is configured.

### SEC-REQ-005 [P1]

Server-function transport supports application-provided idempotency keys without silently retrying non-idempotent operations.

Verification: same-site and cross-site browser tests, missing/invalid/reused token tests, hostile Origin/Referer/Host fixtures, proxy spoofing, and redirect fuzzing.

## 11. Authentication and authorization boundaries

The framework does not provide an identity provider in core, but its primitives must not confuse authentication with authorization.

### SEC-AUTH-001 [P0]

Route, action, endpoint, and server-function APIs expose explicit authorization hooks or patterns. A user identity alone does not grant resource access.

### SEC-AUTH-002 [P0]

Request context cannot be reused across requests. Authentication state must be derived or verified per request and stored only in request-local context.

### SEC-AUTH-003 [P1]

Cookie helpers default to `HttpOnly`, `Secure` in secure production contexts, an explicit `SameSite` value, narrow path, and validated domain behavior. Relaxation is explicit.

### SEC-AUTH-004 [P1]

Session rotation, logout invalidation, expiry, and replay behavior are defined by official session integrations and covered by conformance tests.

Verification: concurrent identity isolation, insecure cookie diagnostics, authorization-denial tests, and session-integration contract tests.

## 12. Cache security and isolation

### SEC-CACHE-001 [P0]

Responses that depend on cookies, authorization, request identity, or private data default to private/no-store. Public caching requires an explicit declaration and build/runtime warning when private dependencies are detected.

### SEC-CACHE-002 [P0]

Cache keys are namespaced and include all declared variation dimensions. Secrets, complete cookies, authorization headers, personal data, and unbounded raw inputs are excluded from keys and logs.

### SEC-CACHE-003 [P0]

Cache entries, tags, and invalidation commands cannot cross application, environment, or configured isolation namespaces.

### SEC-CACHE-004 [P0]

Header merging prevents cache poisoning through conflicting `Vary`, `Cache-Control`, surrogate, or host-derived values.

### SEC-CACHE-005 [P1]

Stampede protection, stale fallback, regeneration failures, and clock skew follow defined behavior without serving another user’s response.

Verification: cross-user fixtures, cache poisoning corpus, namespace collision tests, concurrent misses, failed regeneration, and multi-process determinism tests.

## 13. Secrets, environment, and client boundaries

### SEC-SECRET-001 [P0]

Imports from server-only or secret-bearing modules into client graphs fail the build. The diagnostic names the module boundary without printing values.

### SEC-SECRET-002 [P0]

Public environment values require explicit declaration and schema validation. Naming convention alone may be supported but must remain visible in generated security manifests.

### SEC-SECRET-003 [P0]

Errors, diagnostics, logs, traces, manifests, source maps, and telemetry redact secret values and sensitive paths before reaching sinks or clients.

### SEC-SECRET-004 [P1]

Source-map publication is an explicit deployment choice. Private source-map upload integrations must not place maps in public asset output.

### SEC-SECRET-005 [P1]

Build and runtime child processes receive only required environment variables where tooling permits.

Verification: canary secrets across source, env, headers, and bodies; client-bundle scanning; public-manifest scanning; log and error snapshots; source-map deployment tests.

## 14. Development server and tooling

### SEC-DEV-001 [P0]

The development server binds to loopback by default. Network exposure requires an explicit flag and displays a warning with accessible URLs.

### SEC-DEV-002 [P0]

Static file serving, source viewing, and stack-frame resolution are confined to allowed roots after canonicalization and symlink handling.

### SEC-DEV-003 [P0]

HMR, inspector, and development RPC validate origin and an unguessable per-session token when exposed beyond loopback.

### SEC-DEV-004 [P0]

Development overlays and APIs do not expose environment values, authorization data, full cookies, request bodies, or files outside the project roots.

### SEC-DEV-005 [P1]

Development endpoints enforce payload, connection, and message-rate limits sufficient to prevent accidental local resource exhaustion.

### SEC-DEV-006 [P1]

Development-only code and routes are absent from production manifests and bundles.

Verification: traversal and symlink corpus, hostile Host and Origin tests, network-exposure test, unauthenticated HMR/RPC attempts, secret redaction, and production bundle inspection.

## 15. Plugins, adapters, and supply chain

### SEC-SUPPLY-001 [P0]

Documentation clearly states that build plugins and runtime plugins execute trusted code. The framework must not describe metadata-based permissions as a sandbox.

### SEC-SUPPLY-002 [P0]

Official packages use locked dependencies, automated vulnerability scanning, secret scanning, license checks, and release provenance supported by the registry/toolchain.

### SEC-SUPPLY-003 [P0]

Release artifacts are produced in controlled CI from reviewed commits. Publishing permissions use least privilege and protected environments.

### SEC-SUPPLY-004 [P1]

Official plugins declare lifecycle hooks, client injection, runtime capabilities, filesystem output roots, network behavior where practical, and telemetry behavior.

### SEC-SUPPLY-005 [P1]

Dependency additions require maintenance, ownership, download-script, transitive-risk, and license review. Dependencies with install scripts require explicit approval.

### SEC-SUPPLY-006 [P1]

Plugin output paths are canonicalized and restricted to declared build/cache roots unless the user grants an explicit broader path.

Verification: dependency policy CI, provenance verification, package-content review, malicious output-path fixture, and publish dry run.

## 16. Server-side request forgery and outbound network access

Core does not automatically fetch arbitrary user-provided URLs.

### SEC-SSRF-001 [P0]

Framework helpers that perform outbound requests must treat destinations as untrusted, preserve URL parsing semantics, and document DNS rebinding, redirect, and private-network risks.

### SEC-SSRF-002 [P1]

Official image, content, proxy, or metadata plugins that fetch remote URLs provide host/protocol allowlists, redirect limits, response-size limits, timeouts, and private-address controls.

### SEC-SSRF-003 [P1]

User credentials and authorization headers are not forwarded across origins or redirects unless explicitly configured.

Verification: loopback/private/link-local destination tests, alternate IP encodings, redirect chains, DNS-rebinding simulation where practical, and oversized response handling.

## 17. Files, uploads, and assets

### SEC-FILE-001 [P0]

Uploaded filenames are metadata only and may not select server paths. Temporary paths are generated by trusted APIs.

### SEC-FILE-002 [P0]

Upload limits cover total bytes, part count, per-part bytes, header bytes, time, and nested parsing. Abort removes partial temporary resources when possible.

### SEC-FILE-003 [P0]

Static asset handling prevents traversal, unsafe MIME inference, response sniffing, and unintended execution of user-controlled files.

### SEC-FILE-004 [P1]

Archive extraction, image processing, and media transformation belong in hardened plugins with decompression-bomb and parser-risk controls.

Verification: traversal filenames, Unicode separators, reserved platform names, MIME confusion, oversized multipart, slow upload, and decompression-bomb fixtures where relevant.

## 18. Availability and resource control

### SEC-DOS-001 [P0]

Request cancellation and deadlines propagate through middleware, loaders, actions, server functions, renderers, cache operations, and adapters.

### SEC-DOS-002 [P0]

Parsers, serializers, route matchers, rewrite chains, error-cause chains, and streamed boundaries enforce depth and size limits.

### SEC-DOS-003 [P1]

Framework APIs expose hooks for application and platform rate limiting without embedding a single storage vendor.

### SEC-DOS-004 [P1]

Graceful shutdown stops accepting new work, allows bounded in-flight completion, aborts remaining work, and closes resources.

Verification: slow clients, aborted streams, deep objects, oversized values, recursion limits, high-cardinality routes, and shutdown under load.

## 19. Cryptography and randomness

### SEC-CRYPTO-001 [P0]

The framework does not implement custom cryptographic primitives. It uses maintained Web Crypto or runtime APIs.

### SEC-CRYPTO-002 [P0]

Security tokens, nonces, opaque IDs, and session identifiers use cryptographically secure randomness with sufficient entropy.

### SEC-CRYPTO-003 [P1]

Algorithms, key sizes, rotation, and verification behavior for official integrations are documented and versioned. Timing-sensitive comparisons use appropriate runtime primitives.

Verification: static code review, randomness-source tests, deterministic-test-only separation, and integration-specific cryptographic review.

## 20. Logging, privacy, and observability

### SEC-OBS-001 [P0]

Logs and traces are allowlist-based by default. Sensitive headers, cookies, query values, request and response bodies, cache keys, environment values, and personal data are excluded.

### SEC-OBS-002 [P0]

Redaction occurs before data reaches user-provided or vendor sinks. Error causes are sanitized recursively.

### SEC-OBS-003 [P1]

Metric labels avoid raw URLs, user IDs, function IDs that reveal source, and any unbounded user-controlled value.

### SEC-OBS-004 [P1]

Framework product telemetry is opt-in and its payload can be inspected. It never includes source, project names, route names, paths, environment values, or secrets.

Verification: canary-secret propagation tests, malicious error-cause tests, metric cardinality review, and no-network default tests.

## 21. Secure headers and browser policy support

### SEC-HEADER-001 [P1]

The framework provides composable helpers and strict starter guidance for CSP, HSTS, `X-Content-Type-Options`, referrer policy, frame restrictions, permissions policy, cross-origin isolation where appropriate, and secure cookies.

### SEC-HEADER-002 [P1]

Header merging is deterministic and cannot silently weaken a stricter parent or platform policy. Conflicts produce diagnostics.

### SEC-HEADER-003 [P1]

Security headers remain consistent across normal, redirected, error, streamed, and static responses where applicable.

Verification: browser header fixtures, merge conflict tests, static/SSR parity, and error-path coverage.

## 22. Abuse cases

The security test suite must include at least these abuse cases:

- An attacker injects `</script>` and Unicode variants into loader data.
- A user requests encoded traversal paths through every official adapter.
- A malicious origin submits cookie-authenticated mutation requests.
- A forged forwarded-host attempts password-reset or absolute-URL poisoning.
- One authenticated user primes a public cache with private content for another user.
- A plugin writes outside the build directory or reads all environment secrets.
- A client imports a server-only module through a transitive dependency.
- An attacker opens a network-exposed HMR socket from a hostile website.
- A server function receives a deeply nested, oversized, or prototype-bearing payload.
- A remote fetch plugin follows a redirect into a private network.
- A multipart upload uses traversal names, too many parts, or slow delivery.
- An error cause contains a token and is sent to a log sink.
- Concurrent SSR requests attempt to reuse nonce, identity, locale, or loader state.
- A rewrite loop or pathological route consumes unbounded CPU.

## 23. Security testing program

Required layers:

- Unit tests for validation, escaping, normalization, redaction, keys, and limits.
- Property and fuzz tests for routes, URLs, headers, cookies, serialization, and manifests.
- Browser tests for XSS, CSP, CSRF, redirects, cookies, hydration, and origin behavior.
- Adapter conformance tests for normalization and request semantics.
- Dependency, secret, license, and provenance scanning.
- Static client/server boundary analysis.
- Dynamic tests against production builds.
- Manual threat review for every new trust boundary.
- Independent review before v1 stable and after major security-architecture changes.

Security tests must run against built production artifacts, not only development mode.

## 24. Vulnerability management

The public repository must include:

- A `SECURITY.md` with a private reporting channel.
- Supported release lines and end-of-support dates.
- A severity rubric and target response windows.
- Coordinated disclosure policy.
- Security advisory and patch-release process.
- A method to credit reporters with permission.

Proposed internal targets, subject to maintainer capacity:

| Severity | Initial triage | Mitigation or plan | Release handling |
|---|---:|---:|---|
| Critical | 24 hours | 72 hours | emergency patch/advisory |
| High | 3 business days | 7 days | prioritized patch |
| Medium | 7 business days | 30 days | scheduled release |
| Low | 14 business days | backlog with owner | normal release |

Do not publish target windows as guarantees until the maintainer team can sustain them.

## 25. Security incident response

1. Confirm and privately track the report.
2. Assign severity and affected versions.
3. Restrict information to the response group.
4. Create a minimal reproduction and regression test.
5. Develop and review the fix across supported lines.
6. Audit related components for variant vulnerabilities.
7. Prepare advisory, upgrade instructions, and mitigations.
8. Publish patched versions and verify registry artifacts.
9. Notify ecosystem owners when coordinated changes are required.
10. Complete a blameless post-incident review and add preventive controls.

## 26. Security release gates

### Every pull request

- Required security tests for affected boundaries pass.
- No new critical dependency finding.
- No secret-scanning finding.
- Client/server boundary scan passes.
- New dependencies receive policy review.

### Every prerelease

- Full malicious-input corpus passes.
- Official adapter security conformance passes.
- Production bundle and manifest secret scans pass.
- Security diagnostics contain no unresolved P0 issue.

### v1 release candidate

- Threat model reviewed by maintainers and an independent reviewer.
- All P0 requirements have evidence.
- All P1 requirements are complete or have explicit accepted risk with owner and deadline.
- Independent audit findings are remediated or disclosed as accepted risk.
- Vulnerability reporting and supported-version policy are public.
- Release provenance and package-content verification pass.

### Stable release blocker policy

Any confirmed framework-level vulnerability enabling remote code execution, cross-user data exposure, authentication or authorization bypass, secret disclosure, persistent XSS, public-cache isolation failure, or development-server arbitrary file read blocks release.

## 27. Security acceptance criteria

- AC-SEC-01: Every P0 `SEC-*` requirement maps to a test or documented release gate.
- AC-SEC-02: XSS and serialization corpora cannot execute or escape data containers.
- AC-SEC-03: Client builds contain no server secrets or server-only modules.
- AC-SEC-04: Production logs, traces, errors, manifests, and source-map outputs pass canary-secret scanning.
- AC-SEC-05: Cross-user cache and cache-poisoning suites pass across supported cache modes.
- AC-SEC-06: CSRF, Host, proxy, redirect, and origin suites pass across official server adapters.
- AC-SEC-07: Development-server traversal, symlink, HMR origin, and inspector-access suites pass.
- AC-SEC-08: Request-local state, identity, locale, cache metadata, and CSP nonce remain isolated under concurrency.
- AC-SEC-09: Dependency and publishing workflows provide the approved provenance and policy evidence.
- AC-SEC-10: A private vulnerability-reporting process and supported-version policy exist before public stable release.

## 28. Security ownership

- Core maintainers own security architecture and release decisions.
- Subsystem owners maintain tests for their trust boundaries.
- Adapter maintainers own host-specific request semantics and secure deployment defaults.
- Plugin authors own plugin-specific risk but must satisfy official contract tests to receive an “official” designation.
- Release managers verify security gates and artifact provenance.
- Documentation owners keep secure deployment and unsafe-escape-hatch guidance current.

No single automated scanner can mark the framework “secure.” Security status is the combination of architecture, implementation, verification, dependency hygiene, operational response, and transparent residual risk.

