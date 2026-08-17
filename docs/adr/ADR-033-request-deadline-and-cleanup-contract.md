# ADR-033: Request Deadline, Abort, and Cleanup Contract

- Status: Proposed
- Date: 2026-08-18
- Owner: framework maintainers
- Related tasks: FW-122, FW-110, FW-113, FW-204, FW-217, FW-402
- Security impact: high

## Context

The Node adapter already bounds URL, header, and body sizes, propagates an `AbortSignal`, streams
responses, and performs bounded socket shutdown. It does not define a request deadline, abort work on
a pre-response client disconnect, await application cleanup before shutdown resolves, or safely
classify streamed body overflow. Its public `onError` callback also receives the original exception,
which violates redaction-before-user-sink requirements.

The Security PRD assigns multipart total/part/header/time/nesting limits and partial-resource cleanup
to FW-122, but the repository has no upload parser subsystem. Adding one would cross an unplanned
subsystem boundary. Deadline duration, timeout response, cleanup bound, and safe error-sink API are
also not selected by normative documents.

## Proposed decision

The official adapter owns one finite request deadline from request acceptance through response-body
completion. It composes deadline, client disconnect, request-limit failure, and shutdown into one
request-local `AbortSignal` passed unchanged through the universal pipeline. Core exposes no timer or
runtime-specific deadline API.

Add private-v0.x `requestTimeoutMs` configuration with a conservative finite default and bounded
integer validation. Before response commitment, deadline expiry returns a static timeout response;
after commitment it cancels the response body and closes the connection. Exact default, maximum,
status, and static abort classification require maintainer acceptance before implementation.

Track each request with its controller and one lifecycle-completion promise. Disconnect listeners are
installed before application dispatch. Response streaming is abort-aware and cancellation reaches the
underlying Web stream. A request leaves tracking only after framework-owned cleanup settles.
Concurrent `shutdown()` calls share one memoized promise. Shutdown stops acceptance, closes idle
connections, allows bounded completion, aborts remaining records, awaits cleanup under a separately
bounded final interval, force-closes sockets, and then resolves.

Replace raw-error `onError(error, requestId)` with a production-safe callback receiving only an
approved static diagnostic and request identifier. Original errors, causes, stacks, paths, headers,
cookies, query values, bodies, and environment values never reach user callbacks or clients. A future
trusted observability sink requires FW-217 authority.

FW-122 owns byte-level request limits and lifecycle/deadline behavior for existing HTTP streams. A
maintainer must either authorize an upload-parser subsystem under FW-122 or formally assign every
multipart clause of `SEC-FILE-002` to a new task depending on FW-122. FW-122 cannot be DONE while
those clauses have no approved owner.

## Consequences

The design fixes pre-response disconnect work leaks, makes shutdown awaitable and idempotent, and
removes an unsafe error sink without adding timers to universal core. It is a breaking private adapter
API correction and therefore needs type/runtime documentation evidence. Cooperative user promises
may ignore cancellation, but adapter shutdown and resource ownership remain bounded.

## Required evidence

- Exact-limit and overflow tests for declared and chunked bodies, headers, and request targets.
- Slow upload and deadline tests before and after response commitment.
- Disconnect during pending endpoint, loader, renderer, and response stream.
- Exact-once stream cancellation and renderer cleanup under concurrent terminal races.
- Shutdown under mixed fast, hanging, upload, and streaming load; concurrent shutdown callers.
- Recovery after rejection and listener/resource accounting returning to baseline.
- Redaction canaries across error/cause/path/header/cookie/query/body/environment sinks.
- Multipart hostile corpus and partial-resource cleanup, or an approved ownership amendment.
- Full format, lint, strict type, boundary, runtime, audit, and license gates.

## Approval required

A maintainer must select the finite timeout defaults/bounds/status, final cleanup bound, safe callback
shape, and multipart ownership. Implementation is blocked until those security-sensitive semantics
are accepted.
