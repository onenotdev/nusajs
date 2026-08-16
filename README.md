# [FRAMEWORK_NAME] — Product Requirements Package

This package is the product and engineering source of truth for a global, general-purpose, full-stack web framework written in TypeScript and JavaScript. `[FRAMEWORK_NAME]` is a placeholder until trademark, domain, GitHub organization, and npm scope checks are complete.

## Product mission

Build a web framework that can serve static sites, content platforms, dashboards, SaaS products, e-commerce systems, real-time applications, APIs, and enterprise systems. It should compete through a simpler mental model, explicit caching and rendering, runtime portability, end-to-end type safety, measurable performance, strong security defaults, and excellent diagnostics.

## Required reading order

1. `AGENTS.md` — mandatory operating rules for coding agents.
2. `docs/00_MASTER_PRD.md` — product definition, scope, and success criteria.
3. `docs/01_PRODUCT_PRINCIPLES_AND_USERS.md` — non-negotiable principles and target users.
4. `docs/02_ARCHITECTURE.md` through `docs/08_DX_AND_OBSERVABILITY.md` — subsystem requirements.
5. `docs/09_SECURITY_PRD.md` — security model, requirements, abuse cases, and release gates.
6. `docs/10_PERFORMANCE_AND_BENCHMARKS.md` — performance budgets and fair comparison rules.
7. `docs/11_TESTING_AND_QUALITY.md` — verification and compatibility gates.
8. `docs/12_ROADMAP_AND_RELEASES.md` — milestone exit criteria.
9. `docs/13_POSITIONING_RISKS_AND_DECISIONS.md` — market position, risks, and required ADRs.
10. `docs/14_REQUIREMENTS_TRACEABILITY.md` — requirement-to-test mapping.
11. `CHECKLIST.md` — ordered implementation backlog.

## How to use this package with an AI coding agent

Place this folder at the repository root. The agent must read `AGENTS.md`, the master PRD, and the subsystem documents referenced by the active checklist item before editing code. Only one `READY` task may be active at a time.

Recommended initial prompt:

```text
Read AGENTS.md in full, then read the documents required by the first READY task in CHECKLIST.md. Work only on that task. Restate its acceptance criteria, implement the smallest compliant change, add the required tests, run the quality gates, record verification evidence, and update CHECKLIST.md. Do not start another task until every acceptance criterion for the active task passes.
```

## Source-of-truth priority

If documents conflict, apply this order:

1. `docs/00_MASTER_PRD.md`
2. `docs/09_SECURITY_PRD.md` for security and privacy decisions
3. `docs/01_PRODUCT_PRINCIPLES_AND_USERS.md`
4. The relevant subsystem PRD
5. Accepted architecture decision records
6. `CHECKLIST.md`
7. Code comments

Requirements must be updated before implementation when product behavior changes.

## Package contents

- Product vision, scope, personas, and use cases
- Full technical architecture
- Routing, rendering, data, cache, compiler, adapters, plugins, DX, and observability PRDs
- Dedicated security PRD and security review template
- Performance and competitor benchmark methodology
- Quality, compatibility, release, and governance requirements
- AI-agent operating instructions
- Ordered implementation checklist
- ADR and task templates

## Repository development

The workspace skeleton contains no framework features yet. It exists to enforce the quality gates from `docs/11_TESTING_AND_QUALITY.md` from the first commit. The toolchain is fixed by `docs/adr/ADR-005-monorepo-and-toolchain.md`, and the provisional package identifier is fixed by `docs/adr/ADR-001-codename-and-package-scope.md`.

Layout:

- `packages/*` — publishable framework packages. Empty until the first feature task.
- `examples/*` — example applications. Empty until the first feature task.
- `tests/` — repository-level verification that does not belong to a single package.
- `benchmarks/` — benchmark methodology and harness material.
- `spikes/*` — throwaway measurement code that produces evidence for a decision record. Every spike is `private` and is never published. Spikes must not be imported by framework packages and are excluded from the framework dependency graph. A spike may be deleted once the ADR it supports is superseded.
- `docs/adr/` — accepted and proposed architecture decision records.

Commands, identical locally and in continuous integration:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run verify      # all of the above in order
```

Dependency rules for this repository: development dependencies only until a feature task requires otherwise, exact pinned versions, and dependency install scripts denied by default. Each exception is listed with a justification under `allowBuilds` in `pnpm-workspace.yaml`.

