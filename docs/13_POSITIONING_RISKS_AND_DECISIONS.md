# Competitive Positioning, Risks, and Required Decisions

## Position

`[FRAMEWORK_NAME]` is a universal full-stack framework for teams that want static-first performance, complete application capabilities, explicit caching, end-to-end types, secure defaults, and portable deployment.

It must not be marketed as a replacement for another framework until evidence supports a specific claim.

## Initial product wedge

1. Create a static page with zero framework JavaScript.
2. Add a server loader without restructuring the application.
3. Add one interactive island without hydrating the entire page.
4. Add a typed mutation while the form still works without JavaScript.
5. Deploy equivalent behavior through Node and an edge adapter.
6. Inspect rendering, caching, bundles, capabilities, and security effects.

## Conceptual comparison

| Area | Next.js | Nuxt | Astro | `[FRAMEWORK_NAME]` target |
|---|---|---|---|---|
| UI ecosystem | React | Vue | Multi-UI islands | Renderer contract, one official first |
| Primary strength | Full-stack React | Full-stack Vue | Content/static | Static-to-full-stack progression |
| Cache model | Powerful, potentially complex | Nitro and route rules | Mostly static/on-demand | Explicit and inspectable |
| Runtime model | Multiple deployment targets | Nitro adapters | Adapters | Web-Standard core and conformance |
| Security differentiation | Ecosystem and platform dependent | Ecosystem and server dependent | Smaller dynamic surface | Traceable security requirements and manifests |
| Type-safe server calls | Pattern/ecosystem dependent | Pattern/ecosystem dependent | Actions/endpoints | First-class server functions |

This is not a performance claim and must be updated against pinned official versions before publication.

## Risk register

| ID | Risk | Impact | Probability | Mitigation |
|---|---|---:|---:|---|
| R-01 | Scope becomes too broad | High | High | Milestone exit criteria and small core |
| R-02 | Custom renderer is built too early | High | High | Renderer contract and evidence-based spike |
| R-03 | Excessive Vite coupling | Medium | High | Compiler/runtime boundary and manifests |
| R-04 | Cache correctness or isolation failure | Critical | Medium | Explicit policy and adversarial conformance |
| R-05 | Runtime semantics diverge | High | Medium | Shared runtime and adapter conformance |
| R-06 | Plugin API churn | Medium | High | Experimental/beta lifecycle |
| R-07 | Misleading benchmarks | High | Medium | Fixture parity and raw public data |
| R-08 | Supply-chain compromise | Critical | Medium | Minimal deps, provenance, protected publishing |
| R-09 | Low maintainer bus factor | High | High | Governance, documentation, contributor onboarding |
| R-10 | Name or package conflict | Medium | Medium | Trademark, registry, domain, and organization checks |
| R-11 | AI agents create inconsistent architecture | High | High | Single-task execution, ADRs, hard gates |
| R-12 | Security scope is treated as optional | Critical | Medium | Security PRD precedence and release blockers |
| R-13 | Adoption is too low | High | Medium | Design partners and narrow first win |

## Decisions required before M1

The IDs below are `RESERVED`; they are not accepted authority until a corresponding ADR file has status `Accepted`.

- ADR-001: Temporary codename and package scope. `Accepted` — `docs/adr/ADR-001-codename-and-package-scope.md`.
- ADR-002: First official renderer. `Accepted` — `docs/adr/ADR-002-first-official-renderer.md`.
- ADR-003: Route filesystem convention. `Accepted` — `docs/adr/ADR-003-route-filesystem-convention.md`. Role-suffixed filenames with three amendments: one canonical spelling per URL, folded case and Unicode comparison, and reserved-device-name rejection.
- ADR-004: Route-module API syntax. `Accepted` — `docs/adr/ADR-004-route-module-api-syntax.md`. Analyzable named exports are normative; typed helpers are optional and the compiler never requires them.
- ADR-005: Monorepo and toolchain. `Accepted` — `docs/adr/ADR-005-monorepo-and-toolchain.md`.
- ADR-006: Supported runtime and TypeScript policy. `Accepted` — `docs/adr/ADR-006-supported-runtime-and-typescript-policy.md`. The Node floor is the oldest LTS line still inside its upstream support window, currently `22.12.0`; Node and static output are tier 1, edge adapters tier 2, Bun and Deno tier 3 and not supported; the TypeScript floor is 5.8 with pre-release compilers informational.
- ADR-007: Error-code taxonomy.
- ADR-008: Security-manifest schema and strict-mode behavior. `Proposed` — `docs/adr/ADR-008-security-manifest-and-strict-mode.md`. Part 1, strict-mode behavior, is proposed by FW-018; part 2, the security-manifest schema, is owned by FW-107 and is deliberately undecided. `Proposed` is not accepted authority.

## Decisions required before M3

The IDs below are `RESERVED`; they are not accepted authority until a corresponding ADR file has status `Accepted`.

- ADR-009: Client navigation data protocol.
- ADR-010: Hydration and island syntax.
- ADR-011: Serialization format.
- ADR-012: Browser support policy.
- ADR-013: Development-server network authentication.

## Decisions required before M5

The IDs below are `RESERVED`; they are not accepted authority until a corresponding ADR file has status `Accepted`.

- ADR-014: Cache contract and key format.
- ADR-015: Server-function transport and IDs.
- ADR-016: Distributed invalidation semantics.
- ADR-017: Observability contract and redaction.

## Accepted trade-offs

- v0.x prioritizes correctness, security, and inspectability over the shortest API.
- Runtime-specific features belong in adapters or plugins.
- Initial builds may not be fastest until manifests and correctness stabilize.
- One excellent renderer is better than several incomplete renderers.
- Not every convention from existing frameworks needs compatibility.

