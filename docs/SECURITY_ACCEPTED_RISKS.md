# Security Accepted-Risk Register

Governed by `docs/SECURITY_EVIDENCE_WORKFLOW.md` (FW-009). Form: `templates/ACCEPTED_RISK_TEMPLATE.md`.

This register is the only place an accepted-risk record may live. A residual-risk sentence in a task's completion evidence is a disclosure, not an accepted risk, and does not discharge a `SEC-*` requirement.

Records are retired, never deleted. `RETIRED` rows remain as the audit trail.
An `EXPIRED` record is a release blocker.

`tests/security-evidence-workflow.test.ts` enforces the field set, the status vocabulary, the
review-by format, the requirement IDs and priorities against `docs/09_SECURITY_PRD.md`, and the
rule that an agent may not promote a `P0` record to `ACCEPTED`.

## Active records

## AR-001 — Continuous integration has never executed, so supply-chain controls are unexercised

- Status: RENEWED
- Requirements: `SEC-SUPPLY-002` (`P0`), `SEC-SUPPLY-003` (`P0`)
- Scope: No execution of `.github/workflows/ci.yml` has been observed. Dependency and license scanning have therefore never run in continuous integration, provider-side secret scanning has not been confirmed enabled, and no provenance or publish path has been exercised. Scope is limited to the absence of exercise: the controls are specified, `.github/workflows/ci.yml` carries the dependency and license gates and, since FW-005, a tier-1 matrix covering every supported Node major on three operating systems, `docs/SUPPLY_CHAIN_POLICY.md` defines what those gates mean and what they block on, and `pnpm-lock.yaml` pins every dependency with `allowBuilds` denying install scripts by default. Not in scope: any claim that the specified controls are wrong; any published artifact, because nothing has been published and every package is `private`; and, since the 2026-08-17 amendment below, the absence of version control, which no longer applies.
- Rationale: The gap is now execution, not authority. Restated at the 2026-08-17 amendment: version control is initialized and `main` tracks a remote, so the original rationale — that the agent may not initialize a repository — no longer applies. What has not happened is a confirmed workflow run. No run has been observed from the development environment, and the GitHub CLI is not installed there, so the agent cannot verify one. An unexecuted gate is not evidence under `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.1, and a gate whose execution cannot be checked is in the same position. Discharging `SEC-SUPPLY-002` also still requires provider-side secret scanning with push protection, which is a repository-settings action reserved to the owner, and the framework-specific scans owned by FW-120.
- Compensating controls: every dependency is pinned to an exact version in `package.json` and `pnpm-lock.yaml`, verifiable by `tests/workspace-skeleton.test.ts`; install scripts are denied by default in `pnpm-workspace.yaml`, verifiable by the same suite; no package is publishable, since every manifest sets `private: true`; the local gate `pnpm run verify` runs formatting, lint, type checking, tests, the vulnerability audit, and the license gate, and currently exits zero, so the pull-request scans are exercised locally on every change even though no CI run has been confirmed; `docs/SUPPLY_CHAIN_POLICY.md` section 4 makes the dependency review a manual gate that is active immediately; the CI workflow requests `contents: read` only and sets `persist-credentials: false`, so its first execution carries no credential; since FW-005 the workflow's tier-1 matrix covers every Node major that `docs/SUPPORT_POLICY.md` claims to support, so a supported platform cannot go unscanned once the workflow does run.
- Owner: repository owner
- Approved by: none — this record covers `P0` requirements, and `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 6.3 forbids an agent from promoting such a record to `ACCEPTED`
- Recorded: 2026-08-16
- Renewed: 2026-08-16 by FW-019, first of the two renewals permitted by `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 6.4. A second renewal is the last; a third requires escalation to the core maintainers.
- Amended: 2026-08-17 by FW-005. Version control was found to be initialized, with `main` tracking `origin`, which made this record's title, scope, and rationale factually wrong. The record is corrected rather than renewed or retired: correction is not one of the three section 6.4 lifecycle actions and does not consume the one remaining renewal, and retirement is not available because the remediation has only partly occurred — the repository exists, but no workflow run has been observed, so the requirements still lack evidence. The deferral is now narrower than it was: what is deferred is the execution and its confirmation, not the existence of a repository.
- Review by: M0
- Remediation: the repository owner confirms that `.github/workflows/ci.yml` has executed its gates on all three operating systems and both supported Node majors, and records the run reference, which converts `SEC-SUPPLY-002` from this record to automated-test evidence for its dependency and license halves. Its secret-scanning half additionally requires provider-side secret scanning with push protection enabled on the remote, and the framework-specific scans owned by FW-120. `SEC-SUPPLY-003` converts when the publish dry run of `docs/SUPPLY_CHAIN_POLICY.md` section 8.1 is executed against a real release candidate, which cannot happen before M7.

## Retired records

None.
