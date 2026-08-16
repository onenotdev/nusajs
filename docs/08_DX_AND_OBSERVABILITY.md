# Developer Experience, Documentation, and Observability PRD

## Project creation

The generator provides minimal, basic, and full-stack templates. The default flow asks only decisions that cannot be assumed safely: renderer, package manager when not detected, TypeScript defaulting to yes, and an optional deployment target.

It must refuse non-empty directories unless an explicit force operation lists conflicts. It must never delete unrelated files and must support non-interactive flags for automation.

## Error experience

Development errors include a stable code, concise message, relevant files and source ranges, a concrete fix, and a documentation link. Production errors expose only a safe public code and request ID.

Illustrative format only; the final diagnostic namespace requires the error-taxonomy task and must remain distinct from numeric `FW-*` task IDs:

```text
[DIAG-ROUTE-0042] Conflicting route pattern: /blog/:slug

Files:
- src/routes/blog/[slug].page.tsx
- src/routes/blog/[id].page.tsx

Fix: rename or group one route so each URL is unique.
```

## Inspector requirements

- Route tree and match result.
- Render mode and inference explanation.
- Loader, action, endpoint, and server-function timeline.
- Cache layers, hit/miss, age, key summary, and invalidation source.
- Client, server, and island bundle composition.
- Plugin lifecycle hooks.
- Headers, redirects, and security policies with redaction.
- Capability requirements compared with the active adapter.
- Unsafe escape hatches and security warnings.

Inspector code must be removed from production bundles at compile time.

## Documentation architecture

- Tutorials: first application, data, forms, deployment.
- Concepts: routing, rendering, caching, server/client boundaries, adapters, security.
- Guides: auth integration, database integration, testing, migration, deployment hardening.
- Reference: CLI, configuration, APIs, manifests, error codes.
- Ecosystem: plugins, adapters, providers.
- Releases: changelog, upgrades, compatibility, security advisories.

Runnable documentation examples compile in CI. Starter tutorials run end to end. Internal links and API exports are verified.

## Structured logging

Minimum fields: timestamp, level, event name, request ID, route ID, duration, status, adapter, and safe error code. Headers, cookies, bodies, query values, secrets, and personal data are excluded by default. Redaction occurs before sink delivery.

## Tracing

Recommended spans:

```text
http.request
  router.match
  middleware.*
  loader.* / action.* / endpoint.* / serverFunction.*
  cache.get / cache.set / cache.invalidate
  render
  adapter.respond
```

Tracing follows streaming through completion or abort. OpenTelemetry is an optional official plugin rather than a core dependency.

## Metrics

Recommended metrics include request count and duration, active requests, render duration, data-handler duration, cache hit/miss/stale, response bytes, aborts, and safe error counts. Default labels must not contain raw URLs, user IDs, cache keys, or other unbounded values.

## Product telemetry

Framework usage telemetry is opt-in, documented, inspectable before transmission, and easy to disable. It never sends source, project names, route names, file paths, environment values, or secrets.

## Acceptance criteria

- AC-DX-01: A new user completes create-to-page without manual configuration edits.
- AC-DX-02: Every P0 diagnostic has a stable code and remediation.
- AC-DX-03: Inspector code is absent from production dependency graphs.
- AC-DX-04: Tutorials and reference examples pass CI.
- AC-DX-05: The development overlay passes keyboard and contrast checks.
- AC-OBS-01: Core works without a logging, telemetry, or tracing vendor.
- AC-OBS-02: Secret fixtures never appear in logs or error responses.
- AC-OBS-03: Request abort closes traces with the correct status.
- AC-OBS-04: Default metrics have no unbounded labels.
- AC-OBS-05: Applications can replace log and trace sinks through public APIs.

