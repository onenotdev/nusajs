# ADR-018: Core package and public entry points

- Status: Accepted
- Date: 2026-08-17
- Owner: Core maintainers; drafted by GitHub Copilot (`gpt-pro`) under delegated autonomy
- Related tasks: FW-101, FW-102, FW-103, FW-104, FW-109, FW-111, FW-117, FW-123, FW-701
- Security impact: medium

Accepted by the core maintainer on 2026-08-17. The optional
`@nusajs/core/experimental` entry point remains absent until it has a useful export; FW-101 must not
publish an empty entry point merely to reserve the path.

## Context

FW-101 must create the first framework package and its public API boundary. The architecture PRD
requires a universal core that defines types, lifecycle, capabilities, errors, route contracts,
hooks, and Web-Standard utilities without depending on Node.js, a bundler, a renderer, or a hosting
vendor. It also requires documented entry points, an explicitly unstable `internal/*` area, and API
reports in continuous integration.

ADR-001 reserves the provisional `@nusajs/*` scope but does not decide package topology, public
entry points, export-map policy, or whether application authors import a facade package or the core
package directly. ADR-005 fixes the monorepo toolchain but deliberately implements no framework
feature. These choices are durable public API and architecture decisions: changing package names or
entry points after consumers adopt them creates migration and ecosystem costs.

The initial package must remain small enough to implement and audit before the diagnostic model,
configuration loader, router, renderer, and server exist. FW-101 therefore needs a boundary that can
be tested without inventing those later APIs.

## Decision drivers

1. Universal code must not import Node.js built-ins or runtime-specific packages.
2. Public exports must be explicit, documented, type-tested, and visible in an API report.
3. Application code, official packages, and plugins must not depend on private implementation paths.
4. The first package must not preempt contracts owned by later tasks.
5. ESM is primary, while the supported Node floor must be able to consume the distribution according
   to ADR-006 and the support policy.
6. A future public facade must be possible without creating a dependency cycle.
7. Package renaming must remain possible while `nusajs` and `@nusajs/*` are provisional.

## Options

### Option A — One public `nusajs` package containing all subsystems

Benefits: one obvious application import and minimal package discovery.

Disadvantages: couples universal and runtime-specific code, makes accidental Node.js imports harder
to prevent, grows one export map indefinitely, and makes subsystem ownership and bundle boundaries
opaque. It also commits a public facade before the underlying contracts exist.

### Option B — Public `@nusajs/core` plus subsystem packages, with no facade yet

Benefits: gives universal contracts an enforceable dependency root, permits later packages to depend
in one direction, keeps runtime-specific code outside core, and avoids inventing a facade before the
application authoring surface is known. Explicit package export maps can deny deep imports.

Disadvantages: early examples may use more than one package, and a later facade requires deliberate
re-export and migration policy. The provisional scope is visible in imports until naming is settled.

### Option C — Internal core package with only a public `nusajs` facade

Benefits: application imports can remain short and core can be reorganized behind the facade.

Disadvantages: the facade must publish contracts owned by tasks that have not run, creates pressure
to mix universal and runtime-specific exports, and makes official-package imports either depend on
the application facade or use private paths. Tree-shaking and runtime boundaries become less
inspectable.

### Option D — A single package with public subpath exports for every subsystem

Benefits: one install with explicit imports such as `nusajs/core` and `nusajs/server`.

Disadvantages: package-level dependency scanning cannot enforce universal/runtime separation,
installing a universal utility brings the complete package graph, and every subsystem shares one
release and compatibility boundary from the beginning.

## Decision

Select Option B.

FW-101 creates `@nusajs/core` as a private, ESM-only workspace package. “Private” means unpublished
under ADR-001, not undocumented: the package entry point is the first candidate public framework
surface and is reviewed as such.

The package has exactly these public entry-point classes:

- `@nusajs/core` for stable candidate exports;
- `@nusajs/core/experimental` for explicitly experimental exports, initially empty or absent;
- no wildcard export and no public `internal/*` entry point.

Implementation files live under `src/internal/` when they are not exported. Consumers, examples,
and other packages may not import source files or undeclared subpaths. `package.json` uses an explicit
`exports` map and publishes types beside ESM JavaScript when publication is eventually authorized.
CommonJS source or a second CommonJS build is not produced; ADR-006 governs Node interoperability.

FW-101 exports only boundary primitives needed to prove the package contract without absorbing later
tasks: package identity/version metadata represented as compile-time constants or types, opaque
branding utilities when needed, and Web-Standard-compatible foundational types that are already
normatively fixed. It does not define diagnostics (FW-102), configuration (FW-103), route scanning
(FW-104), request context (FW-109), renderer contracts (FW-111), or cryptographic helpers (FW-123).
If no useful runtime primitive is already fixed, an empty runtime entry point plus type-only boundary
is preferable to speculative API.

Every public export requires TSDoc, a runtime test when it has runtime behavior, a type test, and a
minimal example. An API report or equivalent deterministic export snapshot is committed and checked
in CI. FW-117 scans both source and built output for universal-boundary violations; FW-101 adds the
small local guard needed to prevent undeclared entry points before that generalized scanner exists.

A future `nusajs` facade or additional `@nusajs/*` package requires its owning task and, if it changes
the architecture rather than applying this package graph, an accepted ADR.

## Consequences

Positive:

- Universal core has a mechanically enforceable package boundary.
- Later packages can form the directed graph required by the architecture PRD.
- Deep imports and accidental private API dependencies fail through the export map.
- No application facade or subsystem API is guessed before its owner runs.
- The provisional scope can be renamed mechanically while all packages remain private.

Negative:

- Early internal consumers import `@nusajs/core` directly.
- A later facade may require documented re-exports and migration guidance.
- Build-output and API-report tooling must exist earlier than feature implementation.
- Package-private implementation paths are unavailable even when they seem convenient.

## Security analysis

Affected boundaries are application-to-framework imports, package-to-package dependencies, the
published-package supply chain, and universal code crossing into deployment runtimes.

Relevant requirements are `SEC-SUPPLY-002`, `SEC-SUPPLY-003`, `SEC-SUPPLY-005`, and
`SEC-CRYPTO-001`, plus architecture criteria AC-ARCH-01 and quality criterion AC-QA-03. This ADR
discharges none of them.

Abuse cases include a malicious or compromised dependency entering the universal core, a private
module becoming a de facto unsupported API through deep imports, runtime-specific code accessing
filesystem or process state from a universal request path, and an accidental publish under an
unreserved provisional scope.

Controls are an explicit export map, no wildcard/deep exports, no runtime dependency unless separately
reviewed, no Node.js built-ins in source or built output, private package metadata, no publish script,
exact toolchain dependencies at the workspace root, API-surface snapshots, and dependency-direction
tests. Public exports may not expose secrets, environment state, filesystem paths, mutable global
request state, or custom cryptography.

Residual risk: export maps do not prevent a determined local tool from addressing a source path, and
source-only scans can miss bundler-injected imports. FW-117 must inspect built output. Supply-chain
provenance remains deferred until publication is authorized, and ADR-001's scope-squatting risk
remains active.

## Verification

Before changing this ADR to `Accepted`, reviewers should approve the package name, the absence of an
initial facade, the stable-versus-experimental entry-point policy, and the prohibition on public
`internal/*` exports.

FW-101 implementation evidence must include:

1. package metadata proving private, ESM-only status and explicit exports;
2. a successful consumer fixture importing every declared public entry point;
3. negative fixtures showing undeclared and source deep imports fail;
4. an automated source and built-output check for Node.js built-ins and runtime dependencies;
5. a deterministic API report or export snapshot;
6. TSDoc, runtime tests where applicable, type tests, and an example for every export;
7. package-graph tests proving core has no internal workspace dependency;
8. formatting, lint, strict type checking, targeted tests, and all repository quality gates.

## Rollback or supersede plan

Before publication, reject the proposal and reserve ADR-018 without implementing a package. After
internal implementation but before publication, rename or reorganize the package and update all
workspace consumers atomically. After publication is authorized, a superseding ADR must provide a
facade/re-export period, deprecation diagnostics, migration documentation, and a compatibility plan;
removing an entry point cannot be treated as an internal refactor.
