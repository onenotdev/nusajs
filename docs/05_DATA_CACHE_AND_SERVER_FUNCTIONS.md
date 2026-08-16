# Data, Mutations, Server Functions, and Cache PRD

## Loaders

Loaders read route data, receive typed context, and support cancellation.

```ts
export const load = defineLoader(async ({ params, request, signal }) => {
  return getArticle(params.slug, { signal });
});
```

Rules:

- Server loaders do not run in the browser unless explicitly declared as client loaders.
- Output crossing a network or hydration boundary must satisfy the serialization contract.
- Parallel execution requires an acyclic dependency graph.
- Redirect and not-found use dedicated control primitives.
- Production error mapping does not expose internal causes.

## Mutation actions

- Work through progressive HTML forms.
- Validate content type and enforce route-specific body limits.
- Support Standard Schema-compatible validators.
- Return structured form and field errors.
- Enforce CSRF protection for cookie-authenticated mutations.
- Verify origin according to the security PRD.
- Do not automatically retry non-idempotent mutations.
- Provide idempotency primitives for applications that require them.

## Endpoints

Endpoints accept a Web `Request` and return a Web `Response`. HEAD may be derived from GET without a body. OPTIONS and CORS are never enabled globally without configuration.

## Server functions

Server functions are typed RPC over HTTP, not invisible local calls. The compiler emits an opaque function ID, dispatcher, client stub, validation hooks, and manifest entry.

Requirements:

- Input and output type inference.
- Runtime schema validation at the trust boundary.
- Opaque IDs that do not expose source paths or function names.
- POST as the default transport method.
- CSRF and origin checks.
- Explicit authorization hooks; authentication alone is insufficient.
- Safe public error codes and details.
- Abort, deadlines, and body limits.
- Shared secure serialization behavior.
- Optional request signing belongs to an adapter or plugin, not custom core cryptography.

## Cache layers

1. Browser and HTTP cache headers.
2. CDN or surrogate cache through adapter capabilities.
3. Route response cache.
4. Explicit data/function cache.
5. Build artifact cache.

The framework must not merge these layers into ambiguous terminology.

## Route cache policy

```ts
export const cache = defineCachePolicy({
  mode: "swr",
  maxAge: 60,
  staleWhileRevalidate: 300,
  vary: ["accept-language"],
  tags: ["articles"]
});
```

Minimum modes: `none`, `private`, `public`, `swr`, and `immutable`. Personalized or authenticated responses default to private/no-store.

## Cache keys

Keys include a version namespace, route ID, normalized URL, declared variation dimensions, and build version where required. Raw secrets, authorization values, full cookies, and personal data may not appear in keys or logs.

Reading request properties that are not reflected in a public cache policy should produce a diagnostic when detectable.

## Explicit data cache

```ts
const getUser = cached(
  "user.by-id",
  { ttl: 60, tags: ({ id }) => [`user:${id}`] },
  async ({ id }) => database.user.find(id)
);
```

The namespace is stable and input serialization is deterministic. Distributed stampede protection may use adapter leases, but failure and stale fallback semantics remain consistent.

## Invalidation

```ts
invalidate.path("/articles");
invalidate.tag("article:42");
```

Invalidation reports whether it is immediate or eventual. It may not silently clear unrelated namespaces.

## Acceptance criteria

- AC-DATA-01: Parameters and loader data infer without duplicate user types.
- AC-DATA-02: Mutation forms function without client JavaScript.
- AC-DATA-03: Invalid schemas never call mutation handlers.
- AC-DATA-04: CSRF tests cover same-site, cross-site, missing origin, invalid token, and token reuse behavior.
- AC-DATA-05: Server-function IDs remain stable for equivalent source graphs and reveal no source paths.
- AC-DATA-06: Production errors remove sensitive details.
- AC-CACHE-01: Authenticated or personalized responses never enter public cache by default.
- AC-CACHE-02: Cache keys are deterministic across processes.
- AC-CACHE-03: Tag invalidation cannot clear another namespace.
- AC-CACHE-04: Conformance covers concurrent misses, failed regeneration, stale fallback, and clock skew.
- AC-CACHE-05: Cross-user and cache-poisoning security fixtures pass.

