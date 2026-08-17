# ADR-035: Endpoint Method Contract

- Status: Proposed
- Date: 2026-08-18
- Owner: framework maintainers
- Related task: FW-205
- Security impact: medium

## Context

Accepted ADR-026 establishes endpoint-first route-role selection and a universal Web
`Request`/`Response` pipeline, but explicitly defers method metadata and automatic `405` behavior to
FW-205. Endpoint bindings currently expose one method-agnostic `handle` function. The PRDs require
method endpoints, GET-derived HEAD behavior, explicit OPTIONS/CORS, runtime validation boundaries,
and stable fail-closed diagnostics, without defining their public or manifest representation.

## Proposed decision

Endpoint route modules may export handlers named with the closed uppercase set `GET`, `HEAD`, `POST`,
`PUT`, `PATCH`, `DELETE`, and `OPTIONS`. Each handler receives the existing immutable
`RequestContext` and returns `Response | Promise<Response>`. Compilation discovers exports
statically and never executes application modules. Unsupported method-like exports and duplicate
aliases fail with stable diagnostics.

Generated immutable endpoint bindings contain a method table rather than one method-agnostic
handler. A transitional internal adapter may accept legacy `handle` bindings only for existing tests
and generated code during one documented migration window; new public examples and generated output
use method tables. Route-manifest v1 remains URL/role metadata and is not expanded: executable method
bindings stay in generated server runtime code.

Dispatch remains endpoint-first for every request method. Exact matching uses the normalized uppercase
`Request.method`. An explicit `HEAD` handler wins; otherwise `GET` services HEAD and the framework
returns the same status and headers with a null body. A matched endpoint without a handler returns
`405 Method Not Allowed` and a deterministic `Allow` header in this order: `GET, HEAD, POST, PUT,
PATCH, DELETE, OPTIONS`. `HEAD` appears whenever `GET` or explicit `HEAD` exists.

The framework does not synthesize OPTIONS and does not add CORS headers. OPTIONS is allowed only when
exported explicitly. CORS remains explicit application middleware or endpoint behavior. Method
selection occurs after route matching and before invoking the endpoint handler; FW-206 may define
middleware phases around selection later but cannot cause an unsupported method to fall through to a
page or 404.

Handler types do not claim runtime validation. Applications validate parameters, query values,
headers, cookies, content types, and bodies before use. FW-205 documents a Web-Standards validation
pattern but adds no schema library or dependency. Exceptions continue through the existing production
error boundary; request-local state, cancellation, and response passthrough remain unchanged.

## Consequences

Named exports are compiler-readable, tree-shakable, and familiar while keeping runtime metadata out
of the route manifest. The closed set avoids arbitrary-method ambiguity in v1; extension requires a
future accepted change. Explicit OPTIONS prevents accidental cross-origin policy. GET-derived HEAD
reduces boilerplate while preserving an explicit override.

Changing endpoint bindings is a public compatibility event requiring TSDoc, type tests, runtime tests,
API report updates, examples, release notes, and migration guidance.

## Required evidence

- Static discovery for every supported export without module execution.
- Deterministic method-table output under reversed scanner input.
- Dispatch tests for every method, explicit HEAD, GET-derived HEAD, 405, deterministic `Allow`, and
  endpoint-first behavior when page and endpoint share a URL.
- Explicit OPTIONS only, no implicit CORS, and hostile content-type/cross-origin fixtures assigned by
  the accepted security coverage record.
- Invalid return, thrown error, abort, and concurrent request-isolation tests.
- Universal-boundary evidence proving no Node built-ins in core/compiler-neutral contracts.
- TSDoc, public type tests, API report, executable example, compatibility guidance, and full gates.

## Approval required

A maintainer must accept, amend, or reject named method exports, the closed method set, HEAD fallback,
OPTIONS/CORS behavior, deterministic Allow ordering, runtime-binding migration, and validation
ownership before implementation changes the public endpoint contract.
