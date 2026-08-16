# Roadmap and Release Strategy

Milestones use exit criteria rather than promised dates.

## M0 — Discovery and RFCs

Deliverables:

- Product principles and master PRD approved.
- Threat model and security PRD approved.
- ADR and governance templates.
- Route compiler, Web Request server, SSR renderer, and static-output spikes.
- Benchmark harness baseline.
- Decisions for first renderer and route-module syntax.

Exit: at least two architecture paths compared with evidence; no unowned P0 question.

## M1 — Kernel v0.1-dev

- Monorepo and toolchain.
- Core types and diagnostics.
- Route scanner, matcher, and manifest.
- Web-Standard server runtime.
- Minimal Node adapter.
- CLI dev/build/preview.
- Static and SSR page.
- Initial URL, request-isolation, secret-boundary, and development-server security tests.

Exit: minimal fixture works end to end; core CI and M1 P0 security gates pass.

## M2 — Application fundamentals v0.1-alpha

- Nested layouts and error boundaries.
- Loaders, actions, endpoints.
- Typed parameters and navigation.
- Minimal opt-in client navigation: safe same-origin anchor interception, document-navigation fallback, and accessible focus/history behavior defined by an accepted protocol ADR.
- Metadata and assets.
- Static adapter.
- Forms without JavaScript.
- Starter and tutorial.
- XSS, CSRF, cache-isolation, and production-redaction baseline.

Exit: product acceptance criteria AC-PROD-01 through AC-PROD-05 pass.

## M3 — Enhanced client experience v0.2-alpha

- Enhanced client-navigation protocol and production hardening beyond the v0.1 baseline.
- Hydration runtime.
- Focus, scroll, and prefetch behavior.
- Stable HMR.
- Browser matrix.
- Route inspector.
- HMR origin/session security and production exclusion.

Exit: progressive enhancement works and client/security budgets pass.

## M4 — Progressive rendering v0.3-alpha

- Streaming SSR.
- Islands/selective hydration.
- Hardened serialization.
- Abort and backpressure.
- Bundle inspector.
- CSP and streamed-payload security coverage.

Exit: rendering conformance and full XSS corpus pass.

## M5 — Data platform v0.4-beta

- Server functions.
- Explicit cache API.
- Path and tag invalidation.
- Cache adapter contract.
- Observability hooks.
- CSRF, authorization patterns, cross-user cache, and canary-secret gates.

Exit: cache and mutation security conformance passes on local and one distributed reference cache.

## M6 — Ecosystem v0.5-beta

- Beta plugin API.
- Experimental Bun, Deno, and edge adapters.
- OpenTelemetry plugin.
- Codemod infrastructure.
- Plugin and adapter author documentation.
- Plugin output-root and supply-chain policy enforcement.

Exit: at least two plugins and one third-party adapter use only public APIs and pass security/conformance checks.

## M7 — Production hardening v1.0-rc

- Public API review and freeze.
- Independent security audit and remediation.
- Dedicated benchmark publication.
- Upgrade and compatibility guidance.
- Production deployment hardening guides.
- Design-partner issue closure.
- Vulnerability reporting and supported-version policy.

Exit: no open P0/P1 release blockers and every v1 security gate passes.

## Release channels

- `canary`: qualifying main-branch builds.
- `next`: milestone previews for early adopters.
- `latest`: stable releases only.

Release notes include breaking changes, deprecations, security impact, performance impact, migration steps, and known issues.

## Governance

- Maintainers approve public API and security-sensitive changes.
- An RFC is required for cross-package public semantics.
- An ADR records significant implementation decisions.
- Security response has a restricted maintainer group.
- Contributor licensing, Code of Conduct, and disclosure processes exist before public launch.

