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