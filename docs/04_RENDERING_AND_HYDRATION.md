# Rendering, Streaming, and Hydration PRD

## Rendering model

Rendering location, hydration policy, and delivery strategy are orthogonal and inspectable. A route starts with static rendering unless an explicitly declared or inspectably inferred capability requires another value. The final public syntax and inference algorithm require the renderer and route-module ADRs.

| Dimension | Values | Meaning |
|---|---|---|
| Rendering location | `static`, `server`, `client` | Build-time, request-time, or browser-primary rendering |
| Hydration policy | `none`, `full`, `islands` | No hydration, whole-route hydration, or selected component boundaries |
| Delivery strategy | `buffered`, `streaming` | Complete response buffering or progressive delivery |

Static and server rendering default to no framework client JavaScript. Client rendering requires client JavaScript. Full hydration, islands hydration, or enhanced navigation adds only the client capabilities explicitly required by the route.

## Static rendering

- Dynamic routes provide a parameter enumerator or source plugin.
- Build reports include page count, duration, skipped paths, and failures.
- Identical inputs produce deterministic output.
- Request-only APIs used during static generation fail or explicitly opt the route out.
- Static HTML receives the same escaping and security policy as SSR output.

## Server rendering

- Status and headers are determined before a stream is committed when possible.
- Client abort propagates to loaders and renderers.
- Errors before commit can render a complete error boundary.
- Errors after commit are recorded safely and close the stream according to the renderer contract.
- Request-specific state may not live in module-level mutable variables.

## Streaming delivery

- Implement backpressure and cancellation.
- Every streamed boundary has a server-rendered fallback.
- Serialized data is protected from script breakout and prototype pollution.
- CSP nonces pass through request context without global mutable state.
- Sensitive errors never appear in inline bootstrap payloads.

## Islands hydration

Each island has a build entry, serializable props, a hydration strategy, and a stable opaque ID. Initial strategies:

- `load`: hydrate when the module is ready.
- `idle`: hydrate during idle time with a timeout fallback.
- `visible`: hydrate on viewport entry.
- `media`: hydrate when a media query matches.
- `interaction`: hydrate on the first relevant interaction.
- `never`: server-only output.

Nested islands and cross-island state require explicit contracts. v0.x may restrict nesting to preserve correctness and security.

## Serialization contract

Initial support: null, Boolean, string, finite number, arrays, plain objects, and tagged dates. BigInt, Map, and Set require later security review. Functions, arbitrary class instances, symbols, DOM nodes, cyclic graphs, accessors, and dangerous prototypes are rejected with a value-path diagnostic.

## Hydration mismatch behavior

Development diagnostics include route, boundary, server/client excerpts, and likely nondeterministic sources such as time, random values, locale, or browser-only APIs. Production suppresses source paths and attempts recovery at the smallest safe boundary.

## Zero-JavaScript guarantee

Routes without client capabilities emit no framework bootstrap or hidden data runtime. Tests inspect HTML, asset manifests, and browser network activity.

## Acceptance criteria

- AC-RENDER-01: A static non-interactive fixture ships zero framework JavaScript.
- AC-RENDER-02: SSR propagates request abort to all asynchronous operations.
- AC-RENDER-03: Streaming respects backpressure across adapter conformance tests.
- AC-RENDER-04: The serialization security corpus cannot escape its data container or pollute prototypes.
- AC-RENDER-05: Every hydration strategy has browser tests.
- AC-RENDER-06: Development mismatch diagnostics identify the responsible boundary.
- AC-RENDER-07: Per-request nonce and state isolation pass concurrency tests.

