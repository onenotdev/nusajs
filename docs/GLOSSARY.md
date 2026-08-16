# Canonical Glossary

Status: **Canonical terminology baseline approved by completion of FW-001. Public API spelling remains subject to its governing ADR.**

This glossary gives one meaning to recurring framework terms. Normative documents should use the canonical term and qualify overloaded terms rather than relying on a bare synonym.

## Product and governance

### Acceptance criterion

A uniquely identified, verifiable condition that must pass before its owning requirement, task, milestone, or release is complete. Acceptance-criterion IDs use an `AC-*` namespace.

### Accepted risk

A documented, time-bounded exception approved by an authorized owner. It records scope, rationale, compensating controls, owner, expiry or review date, and remediation plan. An accepted risk does not silently weaken a requirement.

### Architecture decision record (ADR)

A versioned record of a consequential technical or product decision, its alternatives, evidence, consequences, migration, and rollback. Only an ADR with status `Accepted` has architectural authority.

### Evidence

A reproducible artifact or recorded manual gate proving an acceptance criterion or requirement. Examples include command output, test reports, benchmark raw data, conformance results, and review records.

### Framework

The portable core, official packages, tooling, contracts, and supported integrations governed by this repository. The public product name remains `[FRAMEWORK_NAME]` until the naming decision is accepted; `nusajs` is the working repository name only.

### Requirement

A uniquely identified normative product, non-functional, security, or subsystem obligation. Product requirement IDs use `FR-*`; non-functional requirement IDs use `NFR-*`; security requirement IDs use `SEC-*`.

### Request for comments (RFC)

A proposal intended for review before a decision. An RFC is not an accepted architecture decision unless an ADR or governance rule explicitly grants that status.

### Task

A bounded checklist work item with an ID, status, dependencies, outcome, acceptance criteria, security impact, and completion evidence. Task IDs use `FW-*` followed by digits; diagnostic codes must not use this namespace.

## Architecture and runtime

### Application

A user project built with the framework, distinct from framework core and from a deployment platform.

### Capability

A named behavior or facility that may be required, provided, inferred, or optional. Use a qualified term:

- **Application capability requirement**: behavior requested by application code.
- **Client capability**: browser-side behavior requiring framework-owned client output, such as client navigation or hydration.
- **Host capability**: facility supplied by a deployment host, such as streaming, WebSockets, or filesystem access.
- **Adapter capability declaration**: an adapter's machine-readable statement of supported host capabilities.

### Deployment adapter

The public integration that converts framework build/runtime contracts into artifacts and behavior for a deployment target. Server-host adapters and the static-output adapter are subtypes. Use `RuntimeAdapter` only if a future accepted ADR names the public API that way.

### Framework client runtime

Framework-owned code executed in a browser to provide explicitly requested client capabilities.

### Framework server runtime

Portable framework request-processing behavior executed on a server-like host through a deployment adapter.

### Host runtime

The execution platform supplied by Node.js, Bun, Deno, an edge environment, or another deployment target. Avoid bare `runtime` in normative text when this distinction matters.

### Manifest

A deterministic, versioned, machine-readable build artifact describing framework facts such as routes, assets, server/client entries, capabilities, or security boundaries. A manifest must not contain secrets.

### Middleware

A request-pipeline component that performs cross-cutting processing before and/or after downstream handling while preserving request-local state, abort behavior, and explicit authorization boundaries.

### Plugin

Trusted third-party or official code that extends public framework hooks during declared build and/or runtime phases. A public plugin API constrains compatibility, not authority; plugin metadata is not a sandbox.

### Renderer

A component that transforms route UI and data into output such as HTML and associated rendering metadata. A renderer does not adapt the framework to a deployment host.

### Request context

Request-local state created for one request and never reused across requests. It may carry validated identity, locale, deadlines, abort signals, CSP nonces, and other explicitly scoped values.

## Routing and data

### Action

A route-bound handler for a state-changing operation, including progressively enhanced form mutations. Inputs require runtime validation; cookie-authenticated actions receive applicable CSRF and origin protections by default.

### Endpoint

A route handler that directly controls a Web Standards `Response`, including status, headers, and body. An endpoint may read or mutate; mutating endpoints are state-changing operations for security purposes.

### Loader

A route-bound operation that reads data for rendering or navigation without performing application mutations. Execution location must be explicit or inspectably inferred. `Server loader` and `client loader` are execution variants whose precise contracts require an ADR or subsystem decision.

### Route

A matchable application URL pattern and its associated route branch behavior. Avoid `static route`; use `route with static rendering` or `route containing static segments`.

### Route branch

The ordered set of matched route modules, layouts, and boundaries participating in one resolved route.

### Route module

A source module contributing route configuration and one or more route behaviors such as rendering, loading, actions, endpoints, metadata, layouts, or error boundaries.

### Server function

A typed, explicitly exposed client-to-server invocation contract transported by the framework. A mutating server function is a state-changing operation and receives applicable validation, authorization, CSRF/origin, and idempotency controls.

### State-changing operation

The security category encompassing actions, mutating server functions, and mutating endpoints. It is not a separate public API primitive.

### Static segment

A literal URL-path segment without a dynamic parameter.

## Rendering and browser behavior

### Client rendering

UI rendering performed primarily by the browser using framework/client application code. It is distinct from hydration of server-rendered HTML.

### Delivery strategy

How rendered output is transmitted: **buffered delivery** or **streaming delivery**. Streaming is treated as a delivery strategy unless an accepted rendering ADR intentionally defines it as a mutually exclusive render mode.

### Hydration

Browser activation of server-rendered markup using client code. Hydration may be absent, full, or limited to islands.

### Island

A component-level boundary compiled and hydrated independently from the rest of a route. **Islands hydration** is a route hydration policy; an island is not itself a server execution location.

### Rendering mode

Where primary route UI rendering occurs: **static rendering**, **server rendering**, or **client rendering**. Hydration policy and delivery strategy are orthogonal unless an accepted ADR defines a different model.

### Server rendering (SSR)

Rendering route UI per request in the framework server runtime. It may use buffered or streaming delivery.

### Static artifact

A deployable file generated by a build, such as HTML, JavaScript, CSS, an asset, or a manifest.

### Static rendering

Rendering performed at build time to produce static artifacts. This is distinct from a static route segment and from the static-output adapter.

### Static-output adapter

A deployment adapter that emits deployable static artifacts without requiring a framework server runtime at request time.

### Zero framework JavaScript

Exactly zero emitted and transferred bytes of framework-owned JavaScript for a route that requests no client capability. `0 KB` is only a display label and is not the normative measurement.

## Cache and serialization

### Build artifact cache

A cache of compiler/build outputs keyed by deterministic build inputs. It is not an HTTP response cache.

### Cache invalidation

An explicit operation that makes selected cache entries unusable by path, tag, key, namespace, or another declared dimension.

### Cache policy

The declared rules governing eligibility, privacy, variation, freshness, revalidation, storage, and invalidation for a cache layer. Policy is distinct from the storage implementation.

### Data/function cache

A cache of declared loader, server-function, or general server computation results. Entries must be namespaced and isolated from route response cache entries.

### HTTP browser/proxy cache

Caching controlled through standard HTTP semantics between the browser and intermediaries.

### Route response cache

A framework-managed cache of complete route responses. Personalized responses default to private/no-store behavior.

### Surrogate/CDN cache

A deployment-platform or intermediary cache controlled through supported response policy and adapter capabilities.

### Serialization boundary

A trust boundary where values are encoded for transport or embedding. Serialization must enforce supported types, size/depth limits, dangerous-key rejection, escaping, and secret-safe errors.

## Security and environment

### Escape hatch

A per-site, explicitly declared reduction of a security control that a `SEC-*` requirement permits by name. An escape hatch is local to the site that needs it, names what it reduces, and produces a diagnostic, a manifest entry, or a recorded approval. A reduction that no requirement permits is a downgrade, not an escape hatch. `docs/STRICT_SECURITY_MODE.md` section 5 is the complete inventory.

### Fail closed

Preserving a security control's protective outcome by refusing the operation rather than continuing with reduced protection. Refusal is a build failure, a request rejection, a thrown error, or an omitted response, never a repaired value and never a silent continuation. The opposite, proceeding while a control's protection is absent, reduced, or unverified, is failing open and is prohibited except through an escape hatch. `docs/STRICT_SECURITY_MODE.md` section 4 states the rules.

### Public environment value

A non-secret environment-derived value explicitly declared, schema-validated, and recorded in the security manifest as eligible for client exposure. A naming prefix alone is insufficient.

### Secret

A credential, token, key, private configuration value, or sensitive derived value that must remain outside client graphs and be redacted from outputs, diagnostics, logs, traces, manifests, source maps, and telemetry.

### Security manifest

A versioned manifest exposing inspectable security-relevant declarations and boundaries without secret values.

### Strict security mode

The declared security posture of an application, recorded in configuration as `security.mode` and reported in the security manifest. It is a declaration, not a feature switch: it selects no control and, in v0.x, cannot weaken one. Its legal values, its default, and its effect on diagnostic severity are proposed in `docs/adr/ADR-008-security-manifest-and-strict-mode.md` and are not accepted authority until that record's status is `Accepted`.

### Trust boundary

A point where data or control passes from an untrusted or differently trusted party into a component requiring validation, isolation, limits, authorization, escaping, or other controls.

## Diagnostics and observability

### Application observability

Logs, traces, and metrics generated for an application and delivered only to application-configured sinks after allowlisting and redaction. It is distinct from product telemetry.

### Diagnostic

A structured, stable problem record containing a code, explanation, location when available, remediation, and documentation link, with sensitive values redacted.

### Inspector

A development interface for examining framework state such as routes, render mode, client capabilities, cache behavior, manifests, and bundle composition.

### Overlay

A browser presentation surface for development diagnostics. It is not the diagnostic model itself.

### Product telemetry

Privacy-preserving framework usage analytics sent to framework maintainers only after explicit opt-in. It excludes source, project names, routes, paths, environment values, secrets, and personal data.

## Style rules

- Use **Web Standards** and name concrete interfaces such as `Request`, `Response`, `URL`, `Headers`, `ReadableStream`, and `AbortSignal` where behavior is normative.
- Qualify `static`, `runtime`, `cache`, `capability`, and `telemetry` in normative prose.
- Reserve `FW-<digits>` for checklist tasks.
- Treat requirement summaries in traceability tables as non-normative references to their single defining PRD.
