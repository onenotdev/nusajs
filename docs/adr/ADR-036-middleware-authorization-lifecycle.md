# ADR-036: Middleware and Authorization Lifecycle

- Status: Proposed
- Date: 2026-08-18
- Owner: framework maintainers
- Related tasks: FW-121, FW-122, FW-206, FW-207
- Security impact: high

## Context

Accepted ADR-026 reserves middleware and authorization for FW-206 without defining registration,
ordering, `next()` behavior, denial, abort, response policy, or rate-limit ownership. Core currently has
no middleware insertion point. Accepted ADR-029 assigns rate limiting broadly to FW-206, while the
approved security coverage assigns development transport limits to FW-121 and application hooks to
FW-206. Proposed ADR-032 resolves that conflict but is not accepted.

## Proposed decision

`createRequestHandler()` accepts immutable global middleware and an optional strict parent
security-header policy. Route bindings may contain immutable middleware and authorization-hook arrays.
Configuration is defensively copied at handler creation; request context, route metadata, and params
are request-local and read-only. Existing symbol-keyed locals remain the explicit mutable request-local
communication channel and are never shared.

The canonical lifecycle is:

1. validate invocation and abort state;
2. select route role and endpoint method without application execution;
3. create one fresh matched request context;
4. enter global middleware in declaration order;
5. enter matched route middleware root to leaf;
6. evaluate authorization hooks in declaration order;
7. execute endpoint, page pipeline, or framework 404/405;
8. unwind route and global middleware in exact reverse order;
9. apply final strict security-header policy once;
10. return the response.

A middleware receives read-only context and `next(): Promise<Response>`. Returning a `Response`
without calling `next()` short-circuits all downstream work. `next()` may be called at most once; a
second call fails with a registered stable contract error. Return values must be genuine `Response`
objects. Unhandled exceptions propagate to the adapter; outer middleware may deliberately convert a
downstream error to a response. Abort is checked before every middleware, authorization hook, and
terminal handler and is never converted implicitly to 401, 403, 429, or 500.

Authorization hooks run after middleware may establish request-local identity and before protected
application work. Returning `void` permits continuation; returning `Response` denies or
short-circuits. Throwing is an application failure, not denial. The framework defines no identity,
role, provider, session, or storage product. Identity or route possession never implies permission.

Configured parent security headers apply to framework 404/405, short-circuits, authorization denials,
endpoint responses, and buffered or streamed page responses. The pipeline uses strict parent-first
merge semantics and creates a new `Response` instead of mutating an application response. Header
conflicts fail before commitment. Adapter-generated 500 responses require the same policy before
complete error-path parity can be claimed; static parity remains with static/conformance tasks.

This ADR adopts ADR-032's ownership split: FW-121 owns development HTTP/WebSocket/HMR/inspector/RPC
connection, payload, and message-rate limits; FW-206 owns vendor-neutral application/platform
rate-limit hooks expressed as middleware. FW-122/adapters own bytes, deadlines, disconnects, and
transport cleanup. Core provides no counter store and derives no key from secrets or unbounded raw
request values.

Renderer stream cleanup remains governed by ADR-026. Middleware that returns a streaming response
does not receive a hidden stream-completion cleanup hook; such a hook requires a future explicit
contract.

## Consequences

Route selection precedes middleware only to provide immutable matched params; no route application
code runs first. Explicit authorization supports arbitrary authentication systems without putting an
auth product in core. Strict response policy prevents short-circuits from bypassing configured
headers. Complete security-header parity requires coordinated adapter evidence.

## Required evidence

- Exact entry, terminal, and reverse unwind order for global and nested route middleware.
- Zero/one/two `next()` calls, invalid return, short-circuit, caught and uncaught error tests.
- Explicit authorization allow/deny for pages and endpoints with no protected downstream execution.
- Pre-abort, mid-chain abort, concurrent isolation, and immutable-configuration tests.
- Exact-once renderer cleanup retained for buffered, HEAD, stream completion/error/cancel/abort.
- Strict header parity for normal, 404/405, short-circuit, denial, endpoint, and streaming responses;
  official adapter 500 parity is separately evidenced.
- Injected application limiter fixture returning 429 with no vendor dependency and no secret keying.
- TSDoc, type/runtime tests, API report, executable example, migration docs, universal boundaries, and
  full quality gates.

## Approval required

A maintainer must accept, amend, or reject middleware registration and ordering, single-use `next()`,
authorization results, abort/error behavior, strict header policy, adapter parity responsibility, and
the ADR-032 rate-limit ownership split before implementation changes public or security contracts.
