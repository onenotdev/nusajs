# Master Product Requirements Document

## 1. Product summary

`[FRAMEWORK_NAME]` is an open-source, full-stack web framework for TypeScript and JavaScript. It unifies routing, data loading, mutations, rendering, server endpoints, server functions, asset processing, deployment adapters, testing, security controls, and observability behind a coherent contract.

The product is not intended to clone Next.js, Nuxt, Astro, SvelteKit, or any other framework. It learns from modern frameworks while differentiating through explicit behavior, Web-Standard portability, minimal browser output, strong diagnostics, security by default, and end-to-end type safety.

## 2. User problems

Modern web teams frequently encounter:

- Inconsistent server/client mental models.
- Implicit caching that produces stale data or development/production differences.
- Platform-specific runtime behavior and deployment lock-in.
- Separate configuration models for routing, servers, bundlers, and rendering.
- Type safety that stops at the network boundary.
- Excess browser JavaScript for mostly static pages.
- Build and runtime errors without actionable remediation.
- Difficult upgrades with hidden behavioral changes.
- Security controls that require every application team to rediscover the same safeguards.

## 3. Vision

A developer should be able to begin with static HTML and zero framework JavaScript, then add server data, client navigation, streaming, islands, real-time behavior, or client rendering only where required, without migrating to another framework.

## 4. Product goals

### G1 — Predictable behavior

Every route declares or exposes its render mode, data dependencies, cache policy, runtime requirements, and client capabilities. Development and production semantics remain aligned.

### G2 — Portable Web-Standard core

Core contracts do not depend on a hosting vendor. Adapters connect the same runtime semantics to Node.js, Bun, Deno, edge environments, serverless systems, and static output.

### G3 — Performance by default

Static routes ship no framework JavaScript unless they request client capabilities. The compiler emits only the runtime required by each route.

### G4 — End-to-end type safety

Route parameters, query values, loader data, action inputs and outputs, server functions, metadata, and typed navigation are inferred and verified.

### G5 — Secure by default

Trust boundaries, serialization, mutations, cache isolation, secrets, filesystem access, plugin execution, and development tooling have safe defaults and explicit escape hatches. See `09_SECURITY_PRD.md`.

### G6 — Extensible ecosystem

Plugins can extend build, routing, runtime hooks, adapters, virtual modules, and developer tools without importing private internals.

### G7 — Production operability

Structured logs, request IDs, error boundaries, graceful shutdown, health hooks, redaction, tracing integration, and build manifests are first-class concerns.

## 5. Non-goals for v0.x

- Building a UI component library.
- Creating a database, ORM, auth provider, CMS, or commerce engine.
- Operating a proprietary hosting platform.
- Supporting every UI renderer in the first release.
- Providing stable compatibility guarantees before the v1 release candidate.
- Implementing custom cryptographic algorithms.
- Winning every benchmark category.

## 6. Target users

- Solo developers who need safe defaults and a low-friction path to production.
- Product teams that need fast iteration, consistent conventions, and testability.
- Platform and enterprise teams that need portability, governance, policy enforcement, and observability.
- Library and plugin authors that need stable extension contracts.
- Hosting and runtime providers that need adapter contracts and conformance tests.

## 7. Required use cases

| ID | Use case | Core capabilities |
|---|---|---|
| UC-01 | Static marketing site | SSG, assets, metadata, zero JS |
| UC-02 | Large content site | SSG, dynamic paths, incremental builds |
| UC-03 | Documentation portal | Nested layouts, content plugins, search integration |
| UC-04 | Authenticated dashboard | SSR, client navigation, middleware, actions |
| UC-05 | SaaS application | Server functions, APIs, sessions plugin, tracing |
| UC-06 | E-commerce application | Hybrid rendering, cache invalidation, webhooks |
| UC-07 | News portal | High-volume SSG/SSR, CDN cache, metadata |
| UC-08 | Real-time application | SSE/WebSocket adapter capability, interactive islands |
| UC-09 | API-only service | Endpoint router without a UI renderer |
| UC-10 | Enterprise monorepo | Workspace support, policy plugins, incremental builds |
| UC-11 | Edge application | Web-Standard runtime, streaming, no Node dependency |

## 8. v0.1 scope

Included:

- Create/dev/build/preview/typecheck CLI.
- Vite-based development and build pipeline.
- File-based routing with static, dynamic, optional, catch-all, groups, layouts, and error boundaries.
- Web-Standard SSR request pipeline.
- Static generation.
- Opt-in client navigation.
- Loaders and mutation actions.
- API endpoints.
- Metadata/head and basic asset imports.
- Node and static adapters.
- Unit, type, integration, conformance, and example coverage.
- Baseline security controls defined for v0.1 in the security PRD.

Excluded:

- Distributed incremental static regeneration.
- A custom UI compiler.
- Complete visual devtools.
- React Server Components compatibility.
- Stable edge adapters.
- Stable plugin marketplace.
- Built-in database, authentication, email, payment, or CMS products.

## 9. v0.5 scope

- Stable streaming SSR.
- Islands and selective hydration.
- Type-safe server functions.
- Explicit cache API and tagged invalidation.
- Beta plugin API.
- Node, Bun, Deno, Cloudflare-style edge, and static adapters.
- Route and bundle inspectors.
- OpenTelemetry integration.
- Migration and codemod infrastructure.

## 10. v1.0 scope

- Public API compatibility policy.
- Third-party adapter and renderer conformance kits.
- Completed threat model and independent security review.
- Public, reproducible benchmark suite.
- Production deployment guidance.
- Upgrade checker and codemods.
- At least two production design partners.
- Stable extension APIs for primary plugin categories.

## 11. High-level functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Create a project with one CLI command | P0 |
| FR-002 | Compile filesystem routes into a typed manifest | P0 |
| FR-003 | Support static, server, client, island, and stream rendering | P0/P1 |
| FR-004 | Enforce declared loader execution environments | P0 |
| FR-005 | Provide validated, protected mutation actions | P0 |
| FR-006 | Use Web `Request` and `Response` for endpoints | P0 |
| FR-007 | Expose cache policy in route configuration and inspectors | P1 |
| FR-008 | Run the same conformance suite across adapters | P0 |
| FR-009 | Extend the framework through public plugin APIs | P1 |
| FR-010 | Produce stable, actionable error codes | P0 |
| FR-011 | Emit versioned route, asset, server, client, and capability manifests | P0 |
| FR-012 | Provide privacy-preserving, opt-in product telemetry | P2 |
| FR-013 | Enforce the security requirements in `09_SECURITY_PRD.md` | P0 |

## 12. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-001 | Universal packages do not import Node built-ins |
| NFR-002 | All official packages use TypeScript strict mode |
| NFR-003 | Builds are reproducible for identical inputs and toolchains |
| NFR-004 | Every public API has documentation and type tests |
| NFR-005 | Telemetry is disabled unless explicitly enabled |
| NFR-006 | Production dependencies are minimized and audited |
| NFR-007 | Production errors and logs do not expose secrets or internal paths |
| NFR-008 | Server adapters support graceful shutdown where possible |
| NFR-009 | Development supports Windows, macOS, and Linux |
| NFR-010 | ESM is the primary distribution format |
| NFR-011 | Security controls fail closed for unsupported or invalid configurations |

## 13. Success metrics

Adoption:

- Median time from installation to first rendered page.
- Starter completion rate.
- Opt-in project retention after 7 and 30 days.
- Number of production applications, third-party plugins, and adapters.

Quality:

- Crash-free request rate.
- Regressions per release.
- Mean time to resolve P0/P1 issues.
- Percentage of documentation examples compiled in CI.
- Open security findings by severity and age.

Performance:

- Dev server cold start and HMR latency.
- Build time and peak memory.
- Server cold start, throughput, and p50/p95/p99 latency.
- Browser JavaScript, CSS, HTML, and data payload size.

## 14. Product acceptance criteria for v0.1

- AC-PROD-01: A new user can create, run, and build an application using the documented workflow.
- AC-PROD-02: The reference fixture includes static, SSR, dynamic, nested layout, endpoint, loader, action, and error-boundary examples.
- AC-PROD-03: The same fixture passes Node and static adapter conformance for supported capabilities.
- AC-PROD-04: A non-interactive static page ships 0 bytes of framework JavaScript.
- AC-PROD-05: Universal package graphs contain no Node built-ins.
- AC-PROD-06: All v0.1 public APIs have documentation and type tests.
- AC-PROD-07: CI runs lint, type checking, unit, integration, conformance, security smoke, examples, and benchmark smoke suites.
- AC-PROD-08: Every v0.1 P0 security requirement has automated evidence or a documented manual gate.

## 15. Open decisions

- ~~First official renderer: React-compatible or a smaller independent renderer.~~ Resolved by `docs/adr/ADR-002-first-official-renderer.md` (`Accepted`): the smaller independent renderer is first, reached only through the FW-111 renderer contract, with a React-compatible renderer as planned follow-on work.
- Route-module syntax: named exports or `definePage()`.
- Whether client navigation is opt-in per project or inferred from capability usage.
- Stable v1 plugin API boundaries.
- Distributed cache and durable invalidation semantics.

All open decisions require an ADR before implementation.

