# Routing, Layout, Middleware, and Navigation PRD

## Goal

Provide predictable, typed, high-performance routing shared by server and client runtimes. Filesystem conventions should be expressive without creating excessive special names.

## Proposed route structure

```text
src/routes/
├── _layout.tsx
├── _error.tsx
├── index.page.tsx
├── about.page.tsx
├── blog/
│   ├── _layout.tsx
│   ├── index.page.tsx
│   └── [slug].page.tsx
├── api/
│   └── users.endpoint.ts
├── (marketing)/
│   └── pricing.page.tsx
└── docs/
    └── [...path].page.tsx
```

The final convention requires an ADR after a prototype evaluates discoverability, collisions, generated types, and cross-platform filesystem behavior.

## Segment types

- Static: `about`
- Dynamic: `[id]`
- Optional: `[[lang]]`
- Catch-all: `[...path]`
- Optional catch-all: `[[...path]]`
- URL-transparent group: `(marketing)`
- Layout: `_layout`
- Error boundary: `_error`
- Loading boundary: `_loading`
- Page: `*.page`
- Endpoint: `*.endpoint`

Ambiguous or colliding patterns fail at build time. Filesystem enumeration order may not decide precedence.

## Typed route helpers

```ts
routes.blog.$slug({ slug: "hello" }).href;
```

Missing, unknown, or invalid parameters fail during type checking. Query strings use explicit schemas and serializers rather than sharing path-parameter types.

## Layout and error semantics

- Layouts render parent to child.
- Loaders may execute in parallel unless a dependency is declared.
- The nearest eligible error boundary handles data or render failures.
- Headers and status merge through deterministic rules.
- Abort and timeout are control signals, not application errors.
- Error boundaries must not expose sensitive causes in production.

## Middleware

Supported scopes: global, route tree, and endpoint. `next()` may be called at most once. Entry order is parent to child; exit order is child to parent.

Middleware is appropriate for localization, authentication gates, policy headers, redirects, and logging. Primary page data belongs in loaders so dependencies remain visible.

## Redirects and rewrites

- Redirect status is explicit; safe defaults depend on the HTTP method.
- Internal rewrites retain the browser URL and appear in traces.
- Redirect and rewrite loops are detected with a strict depth limit.
- Redirect helpers validate destinations to prevent open redirects unless explicitly allowed.

## Client navigation

- Native anchors remain the baseline.
- Interception occurs only for safe same-origin navigation.
- Modifier keys, `target`, `download`, external relations, and cancellation are respected.
- Focus is restored accessibly and scroll state follows history entries.
- Prefetch defaults are conservative and must respect user data-saving preferences.
- Failed enhanced navigation falls back to document navigation when safe.

## Routing security requirements

- Normalize URLs exactly once using documented rules.
- Reject malformed encodings, null bytes, and unsafe path traversal sequences.
- Define behavior for duplicate slashes, dot segments, Unicode normalization, and case sensitivity.
- Apply host validation before route matching.
- Avoid vulnerable regular expressions and cap route complexity.
- Never derive filesystem paths directly from unmatched URL strings.

## Acceptance criteria

- AC-ROUTE-01: Every segment type has unit, type, and fixture tests.
- AC-ROUTE-02: Collisions report all conflicting files.
- AC-ROUTE-03: Typed helpers reject missing, excess, and invalid parameters.
- AC-ROUTE-04: Middleware order and cleanup are deterministic under abort.
- AC-ROUTE-05: Enhanced navigation preserves native anchor behavior and accessibility.
- AC-ROUTE-06: A 10,000-route fixture meets the approved match-time budget.
- AC-ROUTE-07: The malicious URL normalization corpus passes on every adapter.

