# System Architecture PRD

## Objectives

- Separate universal core semantics from deployment runtimes.
- Permit build-time analysis without arbitrary execution of application modules.
- Use versioned manifests as contracts among the compiler, runtime, tooling, and adapters.
- Maintain a directed package graph without cycles.
- Allow renderer implementations to evolve without rewriting router and server layers.
- Make trust boundaries visible to security tooling.

## Layers

### Core

Defines types, lifecycle, capabilities, errors, route contracts, hooks, and Web-Standard utilities. It may not depend on a bundler, Node.js, a renderer, or a hosting vendor.

### Compiler

Scans routes, validates analyzable exports, builds dependency and capability graphs, generates virtual modules and manifests, transforms boundaries, and emits diagnostics.

### Router

Builds the route tree, matches URLs, extracts parameters, determines layout and error chains, and generates typed navigation helpers.

### Server runtime

Accepts a Web `Request`, creates an isolated request context, runs middleware and data handlers, renders output, applies security and cache policy, and returns a Web `Response`.

### Client runtime

Loads only when required. It handles enhanced navigation, data transitions, hydration or islands, scroll and focus restoration, prefetching, and recovery.

### Renderer

Implements server rendering, streaming, hydration, island bootstrapping, serialization integration, and renderer-specific diagnostics through a public contract.

### Adapter

Connects build and server output to Node.js, Bun, Deno, edge runtimes, static output, or hosting providers. It declares capabilities and does not redefine application semantics.

### Tooling

Includes the CLI, development server, inspectors, testing utilities, codemods, diagnostics UI, and security scanners.

## Package dependency rules

```text
application -> public framework APIs / renderer / plugins
CLI and Vite integration -> compiler -> router and core
adapter -> server and core
server -> router, renderer contract, and core
client -> router and core
core -> no internal package dependency
```

CI must inspect both source and built output for dependency violations.

## Required build artifacts

- `route-manifest.json`: route IDs, patterns, parents, modules, rendering, runtime.
- `asset-manifest.json`: JavaScript, CSS, static assets, and optional integrity values.
- `server-manifest.json`: endpoints, loaders, actions, server functions, middleware, and capabilities.
- `client-manifest.json`: hydration and island entries, enhanced-navigation data.
- `capability-manifest.json`: runtime needs per route and plugin.
- `security-manifest.json`: public/secret environment usage, CSP requirements, unsafe escape hatches, and security diagnostics.
- `diagnostics.json`: machine-readable warnings and errors.

Every manifest has an independent schema version. Adapters reject unsupported major versions.

## Request lifecycle

1. The adapter converts the runtime request to a Web `Request`.
2. The framework creates a fresh `RequestContext`.
3. Host, base path, proxy, and URL policies are validated.
4. Global middleware executes.
5. The router selects a route branch and method.
6. Route middleware executes parent to child.
7. Endpoint, action, loader, or render flow is selected.
8. Authorization hooks and cache policy are evaluated.
9. Data executes with an abort signal and deadline.
10. The renderer creates HTML, a stream, or a data response.
11. Headers and security policies merge deterministically.
12. The adapter sends the response and records redacted application observability signals through configured sinks.
13. Cleanup hooks run on success, error, timeout, or abort.

## Request context contract

```ts
interface RequestContext<Env = unknown> {
  request: Request;
  url: URL;
  params: Readonly<Record<string, string>>;
  env: Env;
  signal: AbortSignal;
  requestId: string;
  locals: Map<symbol, unknown>;
  waitUntil?(promise: Promise<unknown>): void;
}
```

The context must never cross request boundaries. Plugins use typed augmentation or unique symbols. Context values must not be serialized implicitly.

## Capability negotiation

Examples include `streaming`, `websocket`, `backgroundTask`, `edgeCrypto`, `filesystem`, `persistentCache`, and `earlyHints`. The compiler merges requirements. Adapters report `supported`, `emulated`, or `unsupported`.

Builds fail for unsupported required capabilities. Optional capabilities require an explicit fallback.

## Public versus internal API

- Public API is exported only from documented entry points.
- `internal/*` has no compatibility guarantee.
- Plugins may use only public plugin APIs.
- Documentation examples may not import private paths.
- API reports are generated and compared in CI.

## Architecture acceptance criteria

- AC-ARCH-01: Package dependency graphs contain no cycles or runtime-boundary violations.
- AC-ARCH-02: Every build manifest validates against a versioned schema.
- AC-ARCH-03: Concurrency tests demonstrate request-context isolation.
- AC-ARCH-04: Capability mismatches fail at build time with actionable diagnostics.
- AC-ARCH-05: Official adapters share one server runtime rather than forking semantics.
- AC-ARCH-06: Security-sensitive behavior is represented in the security manifest.

