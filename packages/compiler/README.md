# `@nusajs/compiler`

Private Node.js compiler infrastructure for NusaJS. It is not a supported application API.

`scanRouteFiles()` discovers suffix-convention route modules under an explicit absolute root. It
does not execute route modules. Results are immutable, portable, NFC-normalized, and deterministic.
Unsafe roots, escaping symlinks, reserved device names, and portable path collisions fail closed.

`parseRouteGraph()` is the pure follow-up stage. It validates segment grammar, erases transparent
groups, canonicalizes flat and nested index spellings, computes deterministic specificity, and
rejects same-pattern or optional-shadow collisions while naming every conflicting source file.

`parseConfig()` statically loads and validates framework configuration without executing it. Only
literal values are read through the TypeScript parser; function calls such as `adapter: node()` are
recorded as dynamic values and never executed. Unknown properties, invalid values, reserved
property names, and excessive nesting fail closed with an exact property path
(`NUSA-CONFIG-0001`) and a secret-free description of the received value. The only legal
`security.mode` in v0.x is `"strict"`; an absent key defaults to strict (ADR-008).

`createRouteManifest()`, `createSecurityManifest()`, and `createCapabilityManifest()` produce the
versioned build contracts of `docs/02_ARCHITECTURE.md` — deterministic route identities, a
name-only security posture with no secret values (ADR-008 part 2), and a closed capability
vocabulary. `assertManifestSupported()` rejects unsupported schema major versions before any
consumer misreads a future manifest.

`generateRouteTypes()` turns the route manifest into a deterministic TypeScript module. The
generated module exports `RouteId`, `RouteParams`, and a type-safe `href()` function keyed by stable
route identity. Dynamic values are percent-encoded as individual path segments; catch-all values
are non-empty arrays, optional values may be omitted, and missing, extra, or malformed runtime
parameters fail closed with `NUSA-ROUTE-0001`.

`createNusaVitePlugin()` is the private Vite bridge used by framework tooling. Its pre-build hook
statically parses `nusa.config.ts`, securely scans `src/routes`, and serves deterministic
`virtual:nusajs/route-manifest` and `virtual:nusajs/typed-routes` modules. It never imports route or
configuration modules and installs no development-server middleware or network endpoint.

Production security fixtures may opt into `canarySecretScan` with explicit printable-ASCII byte
canaries. A post-ordered build hook scans every final regular output file as opaque bytes, including
JavaScript, CSS, HTML, JSON manifests, binary assets, and external or inline source maps. A match,
unsafe filesystem entry, unreadable output, or resource-limit breach fails the build with the
redacted `NUSA-SECURITY-0002` diagnostic. Scanning cannot be suppressed and never stores canaries in
plugin state or manifests.

This exact-byte mechanism proves only that supplied test canaries are absent from scanned output. It
does not discover arbitrary credentials, decode transformed values, implement client/server import
taint analysis, or redact production logs and errors. Provider-side repository secret scanning and
push protection remain separately required.