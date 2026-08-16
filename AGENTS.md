# AI Coding Agent Rules

## Mission

Build `[FRAMEWORK_NAME]` as a global, general-purpose web framework. It is not an application starter and must not become specific to commerce, multi-tenancy, content, or any single industry. Product claims must be supported by tests, benchmarks, or reproducible evidence.

## Before writing code

1. Read `README.md`, `docs/00_MASTER_PRD.md`, `docs/01_PRODUCT_PRINCIPLES_AND_USERS.md`, and `docs/09_SECURITY_PRD.md`.
2. Read the subsystem documents referenced by the active task.
3. Select exactly one `READY` task whose dependencies are all `DONE`.
4. Restate the task outcome and acceptance criteria.
5. Inspect the repository and preserve unrelated user changes.
6. Create a proposed ADR before implementing a new public API or changing architecture.
7. Perform a security impact check for every new trust boundary, parser, serializer, network action, cache behavior, plugin hook, or filesystem operation.

## Implementation rules

- Use TypeScript strict mode. Do not introduce `any` without an accepted ADR and test coverage.
- Universal packages must use Web Standards such as `Request`, `Response`, `URL`, `Headers`, `ReadableStream`, and `AbortSignal`.
- Universal packages must not import Node built-ins.
- Rendering, caching, network access, environment usage, and side effects must be explicit and inspectable.
- Never share mutable request state across requests.
- Every public API requires TSDoc, type tests, runtime tests, and an example.
- User-facing errors require a stable code, cause, location when available, remediation, and documentation link.
- Experimental APIs require an explicit namespace or flag and do not receive stability promises.
- Save a benchmark baseline before optimizing.
- Security-sensitive defaults may not be weakened to make a demo pass.
- Dependencies require a reason, license check, maintenance check, and supply-chain risk review.

## Single-task workflow

1. Mark the task `IN_PROGRESS`, including date and agent identifier.
2. Implement the smallest change that satisfies the acceptance criteria.
3. Add unit, type, integration, browser, conformance, performance, or security tests as required.
4. Run formatting, lint, type checking, targeted tests, then the required quality gates.
5. Inspect public API, client bundle, runtime compatibility, and security impact.
6. Update documentation and changelog in the same change.
7. Mark the task `DONE` only with command output or artifact evidence.
8. Mark it `BLOCKED` if it needs new authority, an unresolved product choice, or an architecture decision.

## Prohibited behavior

- Do not claim superiority over another framework without reproducible, feature-equivalent benchmarks.
- Do not copy code with unclear or incompatible licensing.
- Do not add an ORM, auth provider, CMS, UI kit, payment system, or business module to core.
- Do not switch package manager, bundler, renderer, test runner, or runtime policy without an ADR.
- Do not skip a failing test to continue to the next task.
- Do not update snapshots without inspecting the semantic change.
- Do not expose secrets, absolute production paths, stack traces, cookies, request bodies, or authorization data in logs or errors.
- Do not implement custom cryptography.
- Do not silently fall back from a secure behavior to an insecure behavior.

## Stop-and-escalate conditions

Stop implementation and request a decision when:

- Normative documents conflict.
- A new public API is not covered by the PRD.
- A secure default would need to be weakened.
- The task grows across more than one unplanned subsystem.
- A benchmark fails its correctness prerequisite.
- A dependency has uncertain licensing, provenance, or maintenance.
- A stable API requires a breaking change.
- A security control cannot be tested reliably.

## Completion report format

```text
Task: FW-XXX
Status: DONE | BLOCKED
Changes: ...
Acceptance criteria: AC-1 PASS, AC-2 PASS, ...
Verification commands: ...
Results/artifacts: ...
Public API changed: yes/no
Security impact: none/low/medium/high — explanation
Documentation/ADR: ...
Remaining risks: ...
```

## General definition of done

- Formatting, lint, type checking, and required tests pass.
- A regression test exists for every fixed bug.
- Universal-package runtime boundaries pass automated checks.
- Documentation examples compile.
- Security acceptance criteria for the affected subsystem pass.
- Public changes include release notes and migration guidance when necessary.

