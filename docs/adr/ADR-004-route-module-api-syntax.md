# ADR-004: Route-module API syntax

- Status: Accepted
- Date: 2026-08-16
- Owner: Lead founding engineer (agent: GitHub Copilot, `gpt-pro`)
- Related tasks: FW-004, FW-101 (core package and public API boundary), FW-105 (route parser), FW-107 (route and security manifests), FW-108 (typed params and href helpers)
- Security impact: medium

## Context

`docs/00_MASTER_PRD.md` section 15 lists "Route-module syntax: named exports or
`definePage()`" as an open decision, and closes with "All open decisions require an ADR
before implementation." The decision is reserved as ADR-004 in
`docs/13_POSITIONING_RISKS_AND_DECISIONS.md`.

ADR-003 decided how a route is *spelled on disk*. This ADR decides what is *inside the
file*: how a route module declares its runtime, rendering mode, parameters, loader, and
component, and how the compiler reads that declaration.

The decision is required now because FW-105 parses route modules, FW-107 serialises
their configuration into `route-manifest.json` and `security-manifest.json`, and FW-108
generates typed parameter and `href` helpers from it. `FR-002` requires filesystem
routes to compile into a typed manifest and `FR-011` requires versioned manifests, so
the manifest cannot be produced without knowing what shape to read.

One constraint dominates every other consideration.
`docs/06_COMPILER_AND_DEV_SERVER.md` states: "The compiler must not execute complete
application modules merely to read route configuration. It should use analyzable
exports or isolated evaluation with an explicit capability boundary. Dynamic
configuration reduces optimization and produces a visible diagnostic."
`docs/02_ARCHITECTURE.md` restates the objective as "Permit build-time analysis without
arbitrary execution of application modules." Executing application code at build time
is both a security boundary crossing and a reproducibility hazard (`NFR-003`), so the
question is not which syntax reads better but which syntax is *statically recoverable*.

FW-004's spike at `spikes/route-convention/` therefore parses candidate route modules
with the TypeScript parser only — `ts.createSourceFile`, no `ts.Program`, no module
resolution, no execution — and measures what each candidate costs to analyse.

## Decision drivers

1. **Recoverability without execution.** Configuration must be readable from the syntax
   tree alone.
2. **Failure mode when configuration is not static.** The PRD requires a visible
   diagnostic, so an unanalyzable initialiser must be distinguishable from an absent
   one.
3. **Analyzer fragility.** A correct-looking analyzer that silently misses a valid
   module is worse than one that errors, because the missing route becomes a 404 with
   no diagnostic.
4. **Type inference quality.** `AC-ROUTE-03` requires typed helpers to reject missing,
   excess, and invalid parameters.
5. **Tree-shaking and client/server separation.** Server-only configuration must not be
   reachable from the client bundle.
6. **Runtime import cost.** Whether authoring a route requires importing framework code
   at all.
7. **Discoverability and teachability.**

## Options

Numbers below are from
`spikes/route-convention/results/route-convention-comparison.md`, generated on Node
v24.16.0 with TypeScript 5.9.3.

### Option A — named exports

```ts
export const route = { runtime: "server", rendering: "streaming", revalidate: 60 };
export const params = { slug: "string" };
export async function loader() { /* ... */ }
export default function Page() { /* ... */ }
```

Measured: literal configuration recovered without execution, `true`, in **2 analyzer
steps**. A computed initialiser produced a **diagnostic** rather than a silent
resolution. **No cross-module binding resolution required.** **No silent miss** under a
name-only matcher, because there is no callee to match — the analyzer walks top-level
`export const` declarations and checks the initialiser is literal.

Benefits: the analyzer is a single pass over top-level statements with no identity
question to answer. Authoring a route requires **no framework import at all**, which
keeps route modules free of a dependency on core and makes them trivially testable in
isolation. Named exports are the natural unit of tree-shaking, so a bundler can drop
`loader` from a client build without framework-specific configuration. The failure mode
is inherently benign: a mistyped export name yields "no configuration found", which is
reportable.

Disadvantages: configuration is spread across several exports rather than gathered in
one call, so there is no single place to hang a type. Getting `AC-ROUTE-03`'s parameter
strictness requires a `satisfies` clause or a generated type import rather than
inference flowing from a function signature. Excess properties in `export const route`
are not rejected by the type system unless the author opts in.

### Option B — `definePage()` wrapper

```ts
import { definePage } from "@nusajs/core";
export default definePage({ runtime: "server", params: { slug: "string" }, component() {} });
```

Measured: literal configuration recovered without execution, `true`, in **5 analyzer
steps** when the analyzer resolves the callee back to its import. A computed initialiser
produced a diagnostic. **Cross-module binding resolution required: `true`.** And the
decisive result: **an aliased import (`import { definePage as dp }`) is silently missed
by a name-only matcher** — the analyzer reports "not found" and the route's
configuration is dropped without a diagnostic. The spike keeps both analyzers and
asserts the naive one fails on the alias, so the fragility is a proven behaviour rather
than a worry.

Benefits: excellent inference. The wrapper's signature can constrain the whole object at
once, reject excess properties, and thread a parameter type into `loader` and
`component` with no `satisfies` ceremony. One import, one call, one object — the
teachable shape. It gives the framework a single place to evolve the config type.

Disadvantages: analysis requires resolving the callee identifier to a framework import,
which means handling aliasing, re-export, namespace import (`core.definePage`), and
local shadowing. Each is a separate way to produce a *silent* wrong answer. Every route
module gains a runtime import of core, so the module cannot be read as data without the
framework present. Tree-shaking a server-only `loader` out of a client bundle is harder,
because it is a property of an object passed to a function rather than a module export.

### Option C — hybrid: analyzable named exports, optional typed helpers

Named exports are the normative, compiler-read surface. The framework additionally
publishes identity-function helpers used purely for type inference:

```ts
import type { RouteConfig } from "@nusajs/core";
export const route = { runtime: "server" } satisfies RouteConfig;
export const params = defineParams({ slug: "string" });
export default definePage(function Page(props) { /* ... */ });
```

The compiler never depends on the helpers being present or being called under their
canonical names; it reads the export names and their literal initialisers. The helpers
exist only so authors can opt into stronger inference.

Benefits: the compiler keeps Option A's 2-step, no-cross-module-resolution,
no-silent-miss profile, and authors keep most of Option B's inference. The helpers are
type-level, so a `import type` plus `satisfies` form needs no runtime import at all.

Disadvantages: two ways to write the same thing, which is a documentation and
consistency cost. The framework must be disciplined about never making the compiler
*require* a helper, or Option C silently degenerates into Option B.

## Decision

**Option C is the route-module API.** Named exports are the normative surface the
compiler reads; typed helpers are optional and type-level.

Concrete reasons:

1. Both candidates can be read without execution, so that requirement does not
   separate them. What separates them is the **failure mode**: the call-based form's
   analyzer produced a measured silent miss on an aliased import, while the named-export
   form has no callee identity to get wrong. A dropped route with no diagnostic is the
   worst available outcome, because it looks like a routing bug rather than a
   configuration error.
2. Analyzer surface area is 2 steps and no cross-module resolution versus 5 steps and
   required cross-module resolution. The cheaper analyzer is also the one with fewer
   places to be subtly wrong, and FW-105 has to be correct on every module in every
   project.
3. Route modules stay importable as plain modules with no framework runtime import.
   That keeps `docs/02_ARCHITECTURE.md`'s dependency rule (core must not be dragged in
   by application route files) intact and makes route modules unit-testable without
   framework bootstrap.
4. Named exports are the unit bundlers already tree-shake, so keeping server-only
   configuration in its own export makes client/server separation a bundler-native
   operation rather than a framework-specific one.
5. Option B's real advantage is inference, not analyzability — and Option C keeps it.
   Rejecting Option B outright would have traded away good ergonomics for nothing;
   admitting its helpers as *optional* costs only documentation discipline.

Four binding commitments accompany this decision:

- **C1 — the compiler never requires a helper.** FW-105 must read `export const route`
  and `export const params` from their literal initialisers. If a future compiler change
  needs a helper call to be present or to be recognisable by name, that is a supersede
  of this ADR, not an implementation detail.
- **C2 — unanalyzable configuration is a diagnostic, never an execution.** A computed
  initialiser produces a stable diagnostic code with a remediation, per `FR-010`. The
  compiler must not fall back to evaluating the module, which would be a silent
  downgrade from a secure behaviour to an insecure one and is forbidden by
  `docs/STRICT_SECURITY_MODE.md`.
- **C3 — types never imply runtime validation.** `export const params` describes the
  shape for typed `href` generation and parameter typing only. Per `SEC-INPUT-001`,
  every route parameter remains untrusted at runtime and must be validated explicitly.
  The API must not be named or documented in a way that suggests otherwise.
- **C4 — the exact export names and the config schema are FW-101's to finalise within
  this shape.** This ADR fixes the *mechanism* (top-level named exports with literal
  initialisers, read from the syntax tree) and leaves the vocabulary to the task that
  defines the public API boundary. `export const route` / `export const params` /
  `export default` are the working names used above.

## Consequences

Positive: the compiler's route reader is a single-pass, syntax-only analyzer with no
module resolution and no execution. Route modules carry no mandatory framework import.
Server-only exports tree-shake natively. The Master PRD's open decision closes.

Negative and honest: the config object is not type-checked unless the author writes
`satisfies RouteConfig`, so a typo in `export const route` is a silent no-op at the type
level even though the compiler will report an unknown key. Two authoring styles exist,
which doubles the surface documentation must keep coherent — and the temptation to
"simplify" by making the helper mandatory will recur, which is exactly what C1 forbids.
`AC-ROUTE-03`'s strictness now depends on generated types rather than on a wrapper's
signature, so FW-108 carries more of the burden than it would have under Option B.

What becomes harder: evolving the config schema. Under Option B a signature change
surfaces as a type error at every call site; under Option C an unknown key surfaces only
as a compiler diagnostic. FW-102's diagnostic model therefore has to cover unknown and
deprecated configuration keys well, because the type system will not do it for free.

What this ADR does not decide: how a route is spelled on disk (ADR-003), the manifest
schema (`FR-011`, FW-107), the error-code taxonomy (ADR-007, unauthored), and whether
client navigation is opt-in — still open in Master PRD section 15.

## Security analysis

Trust boundary affected: **build-time execution of application code**. This is the
boundary the decision is really about. A compiler that imports and runs a route module
to read its configuration inherits everything that module can reach — environment
variables, filesystem, network — during a build that may run in CI with credentials
present.

- **`SEC-INPUT-001` (all route inputs untrusted; types must not imply runtime
  validation).** Commitment C3 binds this. `export const params` is a typing and
  codegen input, not a validator. FW-108 must not generate anything that reads as
  runtime validation.
- **`SEC-SECRET-*` / build-time secret exposure.** Choosing syntax-only analysis means
  the compiler never evaluates module top-level code, so a route module cannot cause
  secret reads during route discovery — not because the module is trusted, but because
  it is never run. This is the primary security benefit of the decision and the reason
  the alternative "isolated evaluation with an explicit capability boundary" permitted
  by `docs/06_COMPILER_AND_DEV_SERVER.md` was not chosen: an isolate boundary is a
  control that has to be built and proven, while not executing is a property that
  cannot regress silently. FW-114 and FW-120 own the secret-scanning evidence; this ADR
  does not discharge them.
- **`SEC-INPUT-005` (complexity limits).** The analyzer walks top-level statements once
  and inspects literal initialisers recursively. Object and array nesting is
  author-controlled, so FW-105 must impose an explicit depth and node-count limit on
  literal analysis rather than recursing without bound. Named as a requirement on FW-105
  here; not implemented.
- **Strict-mode interaction (`docs/STRICT_SECURITY_MODE.md`).** Commitment C2 makes the
  unanalyzable case fail closed with a diagnostic. Falling back to execution would be a
  relaxation of a security-relevant behaviour without a named, visible escape hatch,
  which strict mode forbids.
- **`SEC-SUPPLY-005`.** No new dependency is introduced by this decision. The spike's
  only devDependency is `typescript`, already pinned at 5.9.3 in the root workspace, and
  no install script is granted.

Abuse cases considered:

- *A malicious or compromised route module attempting to run during build.* Prevented
  structurally: the compiler parses, it does not import. A dependency that wants
  build-time execution must obtain it some other way, and `allowBuilds` denial covers
  the install-script path.
- *Configuration smuggling via a computed initialiser.* An author (or a code generator)
  writes `runtime: pickRuntime()` hoping the compiler will evaluate it. C2 makes this a
  diagnostic. The measured fixture `named-exports-dynamic.ts` confirms the diagnostic
  path is reached rather than the value being resolved.
- *Silent route loss as a denial or bypass vector.* This is the Option B failure the
  spike measured. If a route that enforces a check is silently dropped from the
  manifest, a sibling catch-all may serve its URLs instead. Option C removes the
  callee-identity question that caused it.

Residual risk: the spike's analyzers are ~40-line models of what FW-105 will implement,
not FW-105 itself. They establish that the named-export shape is recoverable in one pass
and that the call-based shape has an aliasing hazard; they do **not** prove FW-105 will
be correct. Re-export chains, `export { route } from "./shared"`, and declaration
merging were not measured and remain open questions for FW-105 — each is a potential
"configuration present but not found" case, and each must produce a diagnostic rather
than silence.

## Verification

- `spikes/route-convention/results/route-convention-comparison.md` and
  `.../route-convention-comparison.json` — route-module API table: named exports read in
  2 steps with `crossModuleResolutionRequired: false` and
  `silentMissWithNaiveMatcher: false`; `definePage()` read in 5 steps with both `true`.
- Fixtures: `spikes/route-convention/fixtures/module-api/named-exports.ts`,
  `named-exports-dynamic.ts`, `define-page.ts`, `define-page-aliased.ts`.
- The analysis is enforced, not observed: the harness exits non-zero unless literal
  configuration is recovered without execution, a computed initialiser yields a
  diagnostic, the binding-resolving analyzer survives the alias, and the naive analyzer
  fails on it.
- No module was executed to produce any of these results: the harness uses
  `ts.createSourceFile` only, with no `ts.Program` and no module resolution. The
  fixtures import `@nusajs/core`, which does not exist, which is itself proof that no
  resolution occurred.
- `tests/route-convention.test.ts` asserts that this ADR exists, is `Accepted`, presents
  at least three options, records its four commitments, and cites only `SEC-*`, `FW-*`,
  and `AC-ROUTE-*` identifiers that exist in the requirement documents.

What is **not** verified: no compiler, parser, or type generator exists. `AC-ROUTE-03`
is open and owned by FW-108. `AC-COMP-*` remain open.

## Rollback or supersede plan

The assumption most likely to fail is C1's sustainability — that the compiler can keep
reading plain named exports as the config schema grows. If FW-101 and FW-107 find that
a required key cannot be expressed as a literal initialiser, the correct response is to
extend the literal vocabulary (for example, permitting a small set of framework-provided
constant identifiers with documented values), **not** to make a helper call mandatory.
Making the helper mandatory is a supersede of this ADR and requires re-measuring the
aliasing, re-export, namespace-import, and shadowing cases that Option B failed.

Migration in that direction is mechanical and safe: named exports can be wrapped into a
`definePage()` call by codemod, because the object literal is already the argument
shape. The reverse migration is also mechanical for literal arguments. Neither direction
loses information, which is why adopting Option C now is low-risk.

The trigger for reopening is any of: a configuration key that cannot be expressed
statically; FW-105 finding the literal analyzer cannot distinguish "absent" from
"unanalyzable" reliably; or `AC-ROUTE-03` proving unreachable without a wrapper
signature. Any supersede must re-run
`spikes/route-convention/measure.mjs` and extend it with the re-export, namespace-import,
and shadowing cases this ADR names as unmeasured.
