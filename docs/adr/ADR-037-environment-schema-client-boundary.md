# ADR-037: Environment Schema and Client Boundary

- Status: Proposed
- Date: 2026-08-18
- Owner: framework maintainers
- Related tasks: FW-120, FW-212, FW-214, FW-217
- Security impact: high

## Context

Accepted security requirements demand explicit schema-validated public environment values and a build
failure when server secrets reach a client graph. Prefix-only exposure is insufficient. Security
manifest v1 already records name-only `publicEnv`, and FW-120 scans final artifacts for explicit exact
canaries, but no accepted contract defines schema authoring, namespaces, parsing, build targets,
module graph enforcement, or browser access.

## Proposed decision

Applications declare one statically analyzable `nusa.env.ts` module using the typed identity helper
`defineEnvironment()`. Its closed object contains `server` and `public` namespaces. The v1 schema
vocabulary supports string, URL, boolean, canonical base-10 integer, optionality, string length bounds,
numeric bounds, and finite string enums. It permits no callbacks, computed defaults, regexes, spreads,
getters, transformations, or third-party validators. The compiler reads TypeScript AST and never
executes the module.

Names declared under `server` are unavailable to browser targets. Names under `public` are available
to server and browser only after validation. A prefix may produce migration guidance but never exposes
a value. Official access uses distinct generated modules: `virtual:nusajs/env/server` for server-only
runtime access and `virtual:nusajs/env/public` for validated public values. Client code importing or
transitively reaching the server module fails at build time. Raw `process.env` and unrestricted
`import.meta.env` are not framework public APIs.

The compiler assigns server, client, static-generation, and tooling identities to build graphs and
enforces boundaries on bundler-resolved module identities, including aliases, re-exports, normalized
queries, and statically resolvable dynamic imports. Unknown protected-boundary cases fail closed. This
is declared-boundary enforcement, not general JavaScript information-flow analysis.

Environment parsing occurs once per snapshot: before production server listening, development
startup/restart, or static generation. It reads only declared names, applies unambiguous grammars, and
returns frozen null-prototype typed records. Browser code never reads host environment; its generated
module contains all declared, validated public values in deterministic name order. No raw server value
is retained in serialized compiler state or manifests.

Security-manifest v1 is retained. Its `publicEnv` is derived from schema IR, sorted and deduplicated,
and includes neither values nor server names. Private immutable schema IR may contain names and
constraints but never values. New stable diagnostics distinguish invalid schema, missing/invalid
runtime value, and server-to-client boundary violation. Diagnostics may show names, namespaces,
project-relative locations, and expected categories, but never values, value excerpts/hashes/lengths,
absolute paths, raw environment objects, or caught causes.

Static graph enforcement is the primary leakage prevention. FW-120 remains an independent final-byte
backstop for explicitly injected test canaries in JavaScript, HTML, JSON, binary assets, and source
maps. Production does not enumerate all host environment values merely to create scanner canaries,
and a clean canary scan is never presented as proof of arbitrary-secret absence.

Static adapter/conformance integration is downstream in FW-214 because FW-210/FW-211 are incomplete;
FW-212 defines target behavior and proves production Vite fixtures without claiming unavailable
adapter evidence.

## Consequences

A dedicated declaration module creates a narrow trust-boundary artifact and avoids expanding general
configuration into an executable schema DSL. Distinct virtual IDs make client/server violations
observable and deterministic. The closed vocabulary requires future ADRs for custom validation but
keeps static analysis, browser serialization, and supply-chain scope small.

## Required evidence

- Deterministic AST extraction with unsupported dynamic syntax, unsafe keys, collisions, bounds, and
  depth failing closed without module execution.
- Exact parsing grammars, required/optional behavior, frozen prototype-safe results, and no per-request
  parsing.
- Direct/transitive client violations through aliases, re-exports, dynamic imports, and query forms.
- Client module contains exactly declared validated public values and no server names/values/runtime.
- Security manifest contains sorted name-only public values derived from schema.
- Redacted coded diagnostics under missing, invalid, graph, nested-cause, manifest, source-map, and CLI
  fixtures.
- FW-120 catches separate final-artifact canaries while documentation distinguishes all three controls.
- TSDoc, public type tests, examples, real Vite fixtures, rebuild determinism, and full quality gates.

## Approval required

A maintainer must accept, amend, or reject the declaration filename/helper, closed schema vocabulary,
server/public namespaces, virtual module IDs, graph target classification, startup parsing grammar,
public serialization policy, diagnostics, and FW-120 relationship before implementation establishes
this security-sensitive public and compiler boundary.
