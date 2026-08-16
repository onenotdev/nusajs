# AI Agent Execution Playbook

## Objective

The agent behaves as an auditable engineer rather than a bulk code generator. PRDs define outcomes, `CHECKLIST.md` defines order, accepted ADRs define architectural choices, and verification artifacts define truth.

## Bootstrap prompt

```text
You are working on [FRAMEWORK_NAME], a global full-stack TypeScript web framework. Read AGENTS.md completely, then README.md, docs/00_MASTER_PRD.md, docs/01_PRODUCT_PRINCIPLES_AND_USERS.md, docs/09_SECURITY_PRD.md, and the subsystem documents required by the active task. Select exactly one READY task with completed dependencies. Do not broaden scope or start the next task. Before coding, restate acceptance criteria and security requirements. After coding, run quality and security gates, record evidence in CHECKLIST.md, and mark DONE only when every criterion passes. If a public or architectural decision is missing, stop and create a Proposed ADR.
```

## Resume prompt

```text
Continue the task currently marked IN_PROGRESS. Re-read its notes, the relevant PRDs, the current diff, and the last test results. Do not repeat completed work. Finish the remaining acceptance criteria, verify security impact, run required gates, and update completion evidence.
```

## Review prompt

```text
Review the change for task FW-XXX against its PRDs and acceptance criteria. Prioritize findings for: undocumented public API changes, Node imports in universal packages, hidden cache or render behavior, request-state leakage, unsafe serialization, missing validation or authorization, secret exposure, incomplete abort handling, plugin or filesystem boundary violations, snapshot-only tests, and performance claims without data. Do not fix yet. Report findings by severity with file evidence.
```

## Security review prompt

```text
Use docs/09_SECURITY_PRD.md and templates/SECURITY_REVIEW_TEMPLATE.md to threat-model task FW-XXX. Identify affected assets, trust boundaries, attacker-controlled inputs, abuse cases, controls, resource limits, redaction, cache behavior, dependencies, residual risk, and verification. Map every relevant SEC-* requirement. Block approval if a P0 requirement has no evidence.
```

## Benchmark prompt

```text
Run the benchmark according to docs/10_PERFORMANCE_AND_BENCHMARKS.md. Do not modify fixtures to favor this framework. Verify correctness and security prerequisites first. Store raw data, environment, versions, configuration hash, samples, and summary. Separate cold and warm runs.
```

## ADR prompt

```text
Create an ADR from templates/ADR_TEMPLATE.md for this decision: [...]. Include at least two real options, decision drivers, required prototype or data, security consequences, migration consequences, and rollback. Do not implement until the ADR is Accepted.
```

## Context discipline

- Load only documents relevant to the task plus mandatory core/security PRDs.
- Record assumptions in tasks or ADRs, not conversation memory.
- After a long session, write a checkpoint containing status, diff scope, last commands, failures, security impact, and next action.
- Never state “complete” without mapping evidence to each acceptance criterion.

## Anti-loop rule

Do not repeat a failed command more than twice without a new hypothesis. After two failures:

1. Summarize the error and tested causes.
2. Create a minimal reproduction.
3. Recheck requirements and constraints.
4. Mark the task `BLOCKED` if a new decision or authority is required.

## Parallel work

Parallel agents require non-overlapping package or file ownership. One integrator owns manifests, public API, security boundaries, and final quality gates. Architecture and security decisions may not be parallelized before the governing ADR is accepted.

