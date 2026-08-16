# Security Accepted-Risk Register

Governed by `docs/SECURITY_EVIDENCE_WORKFLOW.md` (FW-009). Form: `templates/ACCEPTED_RISK_TEMPLATE.md`.

This register is the only place an accepted-risk record may live. A residual-risk sentence in a task's completion evidence is a disclosure, not an accepted risk, and does not discharge a `SEC-*` requirement.

Records are retired, never deleted. `RETIRED` rows remain as the audit trail.
An `EXPIRED` record is a release blocker.

`tests/security-evidence-workflow.test.ts` enforces the field set, the status vocabulary, the
review-by format, the requirement IDs and priorities against `docs/09_SECURITY_PRD.md`, and the
rule that an agent may not promote a `P0` record to `ACCEPTED`.

## Active records

## AR-001 — Version control is not initialized, so supply-chain controls are unexercised

- Status: RENEWED
- Requirements: `SEC-SUPPLY-002` (`P0`), `SEC-SUPPLY-003` (`P0`)
- Scope: This working copy has no initialized Git repository. Continuous integration has therefore never executed, dependency and license scanning have never run there, secret scanning does not exist yet, and no provenance or publish path has been exercised. Scope is limited to the absence of exercise: the controls are specified, `.github/workflows/ci.yml` exists and now carries the dependency and license gates as well, `docs/SUPPLY_CHAIN_POLICY.md` defines what those gates mean and what they block on, and `pnpm-lock.yaml` pins every dependency with `allowBuilds` denying install scripts by default. Not in scope: any claim that the specified controls are wrong, and any published artifact, because nothing has been published and every package is `private`.
- Rationale: Initializing a repository and creating commits is reserved to the repository owner. `AGENTS.md` and the operating rules for this workspace permit commits only on explicit instruction, so the agent cannot discharge these requirements without exceeding its authority. The alternative — leaving a `P0` gap undocumented across every task's residual risk — is what `docs/09_SECURITY_PRD.md` objective SO-05 forbids. Restated at renewal: FW-019 removed the specification half of the gap and cannot remove the execution half, because execution requires a repository. What remains deferred is narrower than what was originally recorded, but it is not smaller in consequence: an unexecuted gate is not evidence under `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.1.
- Compensating controls: every dependency is pinned to an exact version in `package.json` and `pnpm-lock.yaml`, verifiable by `tests/workspace-skeleton.test.ts`; install scripts are denied by default in `pnpm-workspace.yaml`, verifiable by the same suite; no package is publishable, since every manifest sets `private: true`; the local gate `pnpm run verify` now runs formatting, lint, type checking, tests, the vulnerability audit, and the license gate, and currently exits zero, so the pull-request scans are exercised locally on every change even though CI has not run them; `docs/SUPPLY_CHAIN_POLICY.md` section 4 makes the dependency review a manual gate that is active immediately; the CI workflow requests `contents: read` only and sets `persist-credentials: false`, so its first execution carries no credential.
- Owner: repository owner
- Approved by: none — this record covers `P0` requirements, and `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 6.3 forbids an agent from promoting such a record to `ACCEPTED`
- Recorded: 2026-08-16
- Renewed: 2026-08-16 by FW-019, first of the two renewals permitted by `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 6.4. A second renewal is the last; a third requires escalation to the core maintainers.
- Review by: M0
- Remediation: the repository owner initializes version control and pushes once, which causes `.github/workflows/ci.yml` to execute the six gates it now defines on all three platforms and converts `SEC-SUPPLY-002` from this record to automated-test evidence for its dependency and license halves. Its secret-scanning half additionally requires provider-side secret scanning with push protection enabled at initialization, and the framework-specific scans owned by FW-120. `SEC-SUPPLY-003` converts when the publish dry run of `docs/SUPPLY_CHAIN_POLICY.md` section 8.1 is executed against a real release candidate, which cannot happen before M7.

## Retired records

None.
