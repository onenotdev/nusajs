# ADR-005: Monorepo layout and toolchain

- Status: Accepted
- Date: 2026-08-15
- Owner: Repository owner, recorded by GitHub Copilot (`gpt-pro`) under delegated autonomy
- Related tasks: FW-002, FW-005, FW-019
- Security impact: medium

## Context

FW-002 must create a workspace with formatting, linting, type checking, testing, and a CI skeleton, without implementing framework features. The toolchain choice is durable: package manager, bundler, renderer, test runner, and runtime policy may not change later without an ADR.

Requirements that constrain this decision include TypeScript strict mode, no Node built-ins in universal packages, minimized and audited dependencies, ESM as the primary distribution format, reproducible builds, cross-platform development, and locked dependencies with vulnerability, secret, license, and provenance controls.

Verified local toolchain: Node.js v24.16.0, pnpm 11.5.1, npm 11.13.0, Corepack 0.35.0, Git 2.54.0. Git is not yet initialized in this directory.

## Decision drivers

- pnpm is already the documented primary package manager.
- Dependency count must stay small and auditable.
- Formatting, linting, and type checking must run on Windows, macOS, and Linux.
- The skeleton must not preselect a renderer or adapter.
- Gates must fail closed in continuous integration.

## Options

### Option A — pnpm workspace with TypeScript, Vitest, ESLint, and Prettier

Benefits: familiar, large rule ecosystem, typed lint rules available.  
Disadvantages: substantially more development dependencies and plugin transitive surface, slower, and more configuration for an empty skeleton. Higher supply-chain review cost.

### Option B — pnpm workspace with TypeScript, Vitest, and Biome

Benefits: one maintained tool covers formatting and linting, very small dependency surface, fast, consistent cross-platform behavior, straightforward CI usage.  
Disadvantages: fewer third-party rules than ESLint; project-specific architectural rules will need dedicated checks anyway, such as the universal-package boundary scanner planned for FW-117.

### Option C — Bun or Deno native workspace tooling

Benefits: fewer separate tools.  
Disadvantages: conflicts with the requirement that Node conformance stabilizes before Bun and Deno work, and would couple core development to a runtime that is not yet the primary target.

## Decision

Option B.

- Package manager: pnpm, pinned through `packageManager` for reproducibility.
- Language: TypeScript in strict mode, ESM only, with `verbatimModuleSyntax` and isolated declaration-friendly settings.
- Formatting and linting: Biome.
- Tests: Vitest.
- Layout: `packages/*` for publishable framework packages, `examples/*` for example applications, `benchmarks/` for the existing benchmark material, and `tests/` for repository-level skeleton verification.
- Continuous integration: one workflow running install with a frozen lockfile, formatting and lint checks, type checking, and tests on Ubuntu, Windows, and macOS.

No renderer, adapter, bundler integration, or framework feature is introduced by this decision.

## Consequences

Positive: a small, auditable dependency graph; deterministic installs; identical local and CI commands; and cross-platform gates from the first commit.

Negative: architectural rules that ESLint plugins might have provided must be implemented as explicit repository checks. That is already required by the planned boundary scanner, so the cost is accepted.

## Security analysis

Affected trust boundaries: dependency and toolchain supply chain, continuous integration, and generated artifacts.

Relevant requirements: `SEC-SUPPLY-002` for locked dependencies and scanning, `SEC-SUPPLY-003` for controlled release workflows, `SEC-SUPPLY-005` for dependency and install-script review, `SEC-SECRET-003` for redacted output, and `NFR-006` for minimized dependencies.

Abuse cases: a malicious or compromised development dependency executing during install or CI; a lockfile bypass introducing an unreviewed version; secrets leaking through CI logs.

Controls: development dependencies only, exact pinned versions, frozen-lockfile installs in CI, a minimal tool count to reduce transitive surface, no publish workflow in this task, no secrets required by the workflow, and all packages private.

Residual risk: Biome and Vitest still execute code during development and CI. Sandboxing is not claimed. Dependency additions remain subject to the policy work in FW-019.

## Verification

The repository runs formatting, lint, type checking, and tests through documented commands on the local platform, and the CI workflow defines the same gates for Ubuntu, Windows, and macOS.

## Rollback or supersede plan

A superseding ADR may replace the linter or test runner. Because the skeleton contains no framework features, replacement affects only configuration files, scripts, and the workflow definition.
