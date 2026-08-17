# Security Evidence and Accepted-Risk Workflow

Task: FW-009. Date: 2026-08-16. Author: lead founding engineer (agent: GitHub Copilot, `gpt-pro`).

Governing documents: `docs/09_SECURITY_PRD.md` (normative for security and privacy), `docs/11_TESTING_AND_QUALITY.md` (gates), `docs/14_REQUIREMENTS_TRACEABILITY.md` (traceability rules), `docs/GLOSSARY.md` (canonical definitions of *evidence* and *accepted risk*), `docs/SECURITY_THREAT_MODEL_APPROVAL.md` (the FW-008 coverage baseline).

## 1. Purpose and authority

`docs/09_SECURITY_PRD.md` section 7 states the rule this document operationalizes:

> Every P0 requirement must map to an automated test, a reproducible manual gate, or an accepted risk before release.

FW-008 produced the map. This document defines the process that keeps the map true: what qualifies as each kind of evidence, where evidence lives, when it stops counting, how a requirement may be deferred, and who may approve a deferral.

This document is procedural. It has authority over how security evidence is recorded and how accepted risks are approved. It has no authority to change a `SEC-*` requirement, its priority, or a release gate. Where it interprets a normative document, the interpretation is marked and listed in section 10 for maintainer confirmation.

No ADR accompanies this task. FW-009 introduces no public API and selects no architecture; it defines a governance process over documents that already exist. The ADR trigger in `AGENTS.md` therefore does not fire. The two checklist amendments in section 9 create tasks; they do not decide those tasks' designs.

## 2. Scope

In scope: evidence qualification, the evidence index, evidence invalidation, coverage-map maintenance, the conditional-requirement registry, the accepted-risk record and register, approval authority, expiry and breach handling, and the binding of all of this to the four gate tiers of `docs/09_SECURITY_PRD.md` section 26 and the pull-request gates of `docs/11_TESTING_AND_QUALITY.md`.

Out of scope, and deliberately left to their owning tasks:

- Strict security mode and fail-closed defaults — FW-018.
- Dependency, license, provenance, and publishing policy, including which scanners run and what a "critical dependency finding" is — FW-019.
- The independent security review required before v1 stable — FW-703. Nothing in this document can satisfy that gate.
- The content of any individual security test or corpus — the owning subsystem task.
- Vulnerability reporting and the supported-version policy — FW-709, created by this task (section 9).

## 3. Evidence model

### 3.1 The three permitted evidence types

`docs/09_SECURITY_PRD.md` section 7 permits exactly three. A fourth marker, `conditional`, is not evidence; it is defined in section 5.

**Automated test.** Qualifies when all of the following hold:

- It runs in continuous integration on every pull request that touches the boundary it protects, not only nightly.
- It is deterministic. A retry may collect evidence but may not turn a failing gate green (`docs/11_TESTING_AND_QUALITY.md`, flaky-test policy).
- It asserts the attacker-observable outcome — what reaches the browser, the log sink, the cache, or the filesystem — rather than an internal implementation detail. FW-003 established the corollary: assert the invariant, not one particular encoding.
- Where `docs/09_SECURITY_PRD.md` section 23 requires it, it runs against built production artifacts and not only development mode.
- Its failure blocks merge.

Does not qualify: a skipped or quarantined test (`AC-QA-06` forbids quarantining a P0 security test); a snapshot accepted without inspecting the semantic change; a type-level assertion alone, because `SEC-INPUT-001` states that types are not validation.

**Reproducible manual gate.** Qualifies when the gate is a written procedure that a different person can re-run and reach the same conclusion. It must record: the named steps, the expected observation, the role that executes it, the date executed, the result, and a stored artifact or command transcript. `templates/SECURITY_REVIEW_TEMPLATE.md` is the recording form for a boundary review; its "Verification evidence" section is where the artifact links go.

Does not qualify: "reviewed by a maintainer" with no procedure; a review whose only output is an approval state; a gate whose expected observation is not written down before it is executed.

**Accepted risk.** Qualifies only as an entry in `docs/SECURITY_ACCEPTED_RISKS.md` with status `ACCEPTED` and every mandatory field of section 6.2 populated. A residual-risk sentence in a task's completion evidence is a disclosure, not an accepted risk, and does not discharge a requirement.

### 3.2 Where evidence lives

There is no separate evidence database at M0. An index with nothing in it is not an index. Evidence is recorded at three levels, each with a fixed home:

1. **Requirement level** — `docs/SECURITY_THREAT_MODEL_APPROVAL.md` section 4. One row per `SEC-*` requirement: owning tasks, planned evidence type, and the milestone by which it must exist. This is the artifact `docs/14_REQUIREMENTS_TRACEABILITY.md` cites for `FR-013` and `AC-SEC-01`.
2. **Task level** — the completion evidence block under the task's line in `CHECKLIST.md`. Required content is fixed by the checklist header: commands, results, affected acceptance criteria, and security impact. A task that discharges part of a `SEC-*` requirement must name that requirement ID in its evidence block, so the requirement can be traced forward from the map and backward from the task.
3. **Release level** — the release-candidate evidence index, assembled by FW-707 and structured by section 7.3 of this document.

A traceability rule already binds level 2: *a task cannot be `DONE` without evidence mapped to its acceptance criteria*. This document adds the reciprocal rule: **a `SEC-*` requirement is not discharged until a task's evidence block names it.** Being listed as an owner in the coverage map is a plan, not evidence.

### 3.3 When evidence stops counting

Evidence is invalidated, and the requirement returns to the state it had before, when any of the following occurs:

- The requirement's text or priority changes in `docs/09_SECURITY_PRD.md`.
- The owning task set changes, including a task being split or renamed.
- The trust boundary changes, which `docs/09_SECURITY_PRD.md` section 23 independently requires a manual threat review for.
- An automated test that served as the evidence is skipped, quarantined, or removed.
- A reproducible manual gate's procedure changes, or its recorded execution predates the change it is meant to cover.
- An accepted risk reaches its review-by date without renewal (section 6.4).

Invalidated evidence must be replaced in the same change that invalidates it, or the requirement must be recorded as an accepted risk or a conditional requirement. Silently leaving a requirement uncovered is prohibited by `AGENTS.md` and by `docs/09_SECURITY_PRD.md` objective SO-05.

## 4. Keeping the coverage map current

This resolves FW-008 finding F-4.

`docs/SECURITY_THREAT_MODEL_APPROVAL.md` section 4 is the single requirement-level map. The family-level table in `docs/14_REQUIREMENTS_TRACEABILITY.md` remains a summary and is not maintained per requirement; the preamble above it says so.

Maintenance rules:

1. **Same-change rule.** Adding, removing, renaming, or re-prioritizing a `SEC-*` requirement, or changing which task owns it, updates the coverage map in the same change. The map may not be updated in a later "cleanup" change.
2. **Amendment record.** The FW-008 record is approved. Later changes to it are appended to its amendments section with the date, the task that made the change, and what changed. Rows are edited in place only when the amendments section explains the edit.
3. **Mechanical enforcement.** `tests/security-coverage.test.ts` asserts that the map covers exactly the declared requirement set, repeats each declared priority, names an owner and an evidence plan, uses only permitted evidence types, references only checklist tasks that exist, and links every unowned or conditional row to a recorded finding. A drifting map fails the build.
4. **What is not mechanical.** Whether a planned evidence type is *adequate* for a requirement is a judgement, not a check. It is decided at the boundary review required by `docs/09_SECURITY_PRD.md` section 23 and recorded on `templates/SECURITY_REVIEW_TEMPLATE.md`.

## 5. Conditional requirements

Some `SEC-*` requirements are scoped to an integration the project has not proposed. They are neither owned nor deferred; they are dormant. Marking them `accepted risk` would overstate the exposure, and marking them owned would be false.

A conditional requirement must appear in this registry with its activation trigger and the task that absorbs it on activation. A coverage-map row marked `conditional` that is absent here is a drift, and the test in section 10 rejects it.

| Requirement | P | Activation trigger | Absorbing task on activation | Finding |
|---|---|---|---|---|
| SEC-AUTH-004 | P1 | An official session integration is proposed | The task that proposes it, which must add session rotation, logout invalidation, expiry, and replay resistance to its acceptance criteria | F-7 |
| SEC-SSRF-002 | P1 | An official plugin that performs outbound fetches is proposed | FW-603 | F-5 |
| SEC-SSRF-003 | P1 | An official plugin that performs outbound fetches is proposed | FW-603 | F-5 |
| SEC-FILE-004 | P1 | An official archive, image, or media processing plugin is proposed | FW-603 | F-11 |

Rules:

- Activation is not optional. Proposing the triggering integration activates the requirement in the same change that proposes it, and the coverage-map row converts from `conditional` to a planned evidence type.
- A conditional `P0` requirement is not permitted. `SEC-SSRF-001` is `P0` and is therefore *not* conditional: it is discharged by a standing gate — core ships no outbound-fetch helper, verified by the FW-701 public API audit, and introducing one requires an accepted ADR.
- Abuse case 10 of `docs/09_SECURITY_PRD.md` section 22 activates with `SEC-SSRF-002`. It is the only one of the fourteen required abuse cases without a current owning task, and FW-008 recorded that as F-5.

## 6. Accepted-risk workflow

### 6.1 When an accepted risk is permitted

`docs/09_SECURITY_PRD.md` section 7 permits a `P1` requirement to miss its applicable beta or stable milestone only when an accepted-risk record documents an owner, deadline, rationale, and compensating controls. Section 26's v1 release-candidate gate repeats it: all `P1` requirements complete or explicit accepted risk with owner and deadline.

**Interpretation I-1 (flagged for maintainer confirmation).** Section 7 also lists accepted risk among the three things a `P0` requirement may map to, while section 26 requires that all `P0` requirements have evidence, and the stable-release blocker policy names classes of defect that block release outright. Read together, an accepted risk over a `P0` requirement is possible but tightly bounded. This document rules:

- A `P0` accepted risk may not be approved by the implementing agent. It requires a named human maintainer approver.
- A `P0` accepted risk may not cover any defect class in the stable-release blocker policy: framework-level remote code execution, cross-user data exposure, authentication or authorization bypass, secret disclosure, persistent XSS, public-cache isolation failure, or dev-server arbitrary file read. For those, the only dispositions are fix and do not release.
- A `P0` accepted risk must be visible in the release notes of any release it spans, not only in the register.

This mirrors the precedent in `docs/PRD_VALIDATION_REPORT.md`, which resolved the same tension for `P1` by making the exception explicit rather than removing it.

### 6.2 Mandatory fields

`docs/GLOSSARY.md` defines an accepted risk as recording scope, rationale, compensating controls, owner, expiry or review date, and remediation plan. Section 7 of the security PRD adds the deadline. The record therefore has ten fields, all mandatory:

| Field | Meaning |
|---|---|
| `Status` | One of `PROPOSED`, `ACCEPTED`, `RENEWED`, `RETIRED`, `EXPIRED`, `BREACHED`. |
| `Requirements` | Every `SEC-*` requirement the risk defers, each with its priority. Use `process` when the risk defers a gate rather than a requirement. |
| `Scope` | Exactly what is exposed, and what is *not*. A scope that cannot be falsified is not a scope. |
| `Rationale` | Why the requirement cannot be discharged now. Convenience and schedule pressure are not rationales on their own. |
| `Compensating controls` | What reduces the exposure in the meantime, each independently verifiable. |
| `Owner` | The role or person accountable for remediation. |
| `Approved by` | The approver, or `none` with the reason approval is withheld. Must differ from the implementing agent for a `P0` risk. |
| `Recorded` | ISO date the record was created. |
| `Review by` | An ISO date, a milestone label `M0` through `M7`, or `before FW-nnn is marked DONE`. Never "TBD" and never open-ended. |
| `Remediation` | The concrete action that retires the record, and who takes it. |

`templates/ACCEPTED_RISK_TEMPLATE.md` is the form. `docs/SECURITY_ACCEPTED_RISKS.md` is the register and the only place a record may live, so that the set of active risks is countable.

### 6.3 Approval authority

| Risk covers | May be approved by |
|---|---|
| A `P1` requirement, or a process gate, at severity low | The implementing engineer or agent, recorded in the register |
| A `P1` requirement at severity medium or higher | A core maintainer who is not the implementer |
| Any `P0` requirement | A named human core maintainer. An agent may only propose it. |
| Any defect class in the stable-release blocker policy | Not approvable |

An agent working under delegated autonomy may create records and set them to `PROPOSED`. It may not promote a `P0` record to `ACCEPTED`. This limit is the same reasoning FW-008 applied to the independent-review gate: a single approver cannot satisfy a control that exists to introduce a second opinion.

### 6.4 Lifecycle

`PROPOSED` → `ACCEPTED` on approval by an authority permitted in section 6.3. `ACCEPTED` → `RETIRED` when the remediation lands and the requirement gains real evidence; the register row stays, with its retirement date, because a deleted risk record destroys the audit trail.

At the review-by date the owner must do exactly one of: retire it, renew it with a new review-by date and a restated rationale (`RENEWED`), or escalate it. A record that passes its review-by date without one of these becomes `EXPIRED`. An `EXPIRED` record is a release blocker: it means a requirement is uncovered and nobody decided anything.

`BREACHED` records the case where the risk materialized. It triggers the incident-response process in `docs/09_SECURITY_PRD.md` section 25 and requires a regression test before the record can be retired, per `AC-QA-02`.

Renewal is not unlimited. A record renewed twice must be escalated to the core maintainers with a decision on whether the requirement itself should change; quietly renewing forever is how a requirement is weakened without an amendment, which `docs/GLOSSARY.md` explicitly forbids.

## 7. Binding to the release gates

### 7.1 Pull-request gates

`docs/11_TESTING_AND_QUALITY.md` lists ten pull-request gates; items 7 and 8 are security gates. `docs/09_SECURITY_PRD.md` section 26 states the per-pull-request security conditions. The evidence a pull request must carry:

| Gate condition | Evidence | Owner of the mechanism |
|---|---|---|
| Security tests for affected boundaries pass | CI run of the affected suites, named in the change description | The owning subsystem task |
| No new critical dependency finding | Scanner output | FW-019 |
| No secret-scanning finding | Scanner output over source and built artifacts | FW-019, FW-120 |
| Universal package boundary scan passes | Boundary scanner run over source and built output | FW-117 |
| New dependencies reviewed | A recorded dependency review with install-script approval | FW-019 |
| A new or changed trust boundary has a threat review | A completed `templates/SECURITY_REVIEW_TEMPLATE.md` | The changing task |

Since FW-019, `.github/workflows/ci.yml` also defines dependency-vulnerability and license gates, and `docs/SUPPLY_CHAIN_POLICY.md` sections 5, 6.2, and 10 define what they block on. FW-120 adds exact-canary production-artifact tests to the runtime suite that the workflow invokes. Defined is not the same as enforceable: continuous integration has never executed in this working copy, and section 3.1 holds that an automated check counts as evidence only once it runs on every pull request and its failure blocks merge. The dependency gates and canary fixtures are locally exercised through `pnpm run verify`; provider-side repository secret scanning and downstream client/log controls remain deferred under `AR-001`.

### 7.2 Prerelease gates

Before any prerelease, the coverage map must show, for every requirement whose "Complete by" milestone is at or before the release's milestone, either a discharged evidence row or a register entry. The check is mechanical enough to automate once milestones start closing; until then it is a reproducible manual gate executed by the release manager and recorded in the release notes.

### 7.3 Release-candidate evidence index

`docs/14_REQUIREMENTS_TRACEABILITY.md` requires that every release candidate include an evidence index linking commit, CI, conformance, benchmark, security, API, documentation, and design-partner artifacts. Its structure, for FW-707 to produce:

| Section | Required link or artifact |
|---|---|
| Commit | The exact commit or tag, and the provenance attestation for the published artifacts |
| CI | The passing run of the full gate set on every platform in the support matrix |
| Conformance | Adapter and renderer conformance results for every officially supported target |
| Benchmark | Raw benchmark data with the correctness prerequisite proven, per `docs/10_PERFORMANCE_AND_BENCHMARKS.md` |
| Security | The coverage map at that commit, the register with no `EXPIRED` row, corpora results, production-artifact scans, and the FW-703 independent-review report |
| API | The public API surface snapshot and its diff against the previous release |
| Documentation | The documentation build with executable examples compiled |
| Design partner | The FW-706 validation record |

The security section is not satisfied while any `EXPIRED` record exists, while any `P0` requirement lacks evidence, or while any `P1` requirement is neither complete nor covered by an `ACCEPTED` record with an owner and a review-by date.

## 8. Disposition of the FW-008 findings

Every finding recorded by FW-008 now has a disposition state. `RESOLVED` means no further action. `SCHEDULED` means the action is owned by a task that exists. `AMENDED` means this task changed the checklist to create the missing owner.

| Finding | Disposition | State |
|---|---|---|
| F-1 | The renderer contract documents the renderer as a specialization of the dependency supply-chain boundary. Tracked as an acceptance criterion of FW-111 when it becomes `READY`. | SCHEDULED |
| F-2 | The release-artifact-to-application boundary is now recorded. FW-019 added it to `docs/09_SECURITY_PRD.md` section 6 and to `docs/SUPPLY_CHAIN_POLICY.md` section 9, and appended amendment A-2 to the approval record. | RESOLVED |
| F-3 | Host-dependent header and MIME limits are documented by the static adapter. Owner FW-211. | SCHEDULED |
| F-4 | Resolved by section 4 of this document: the coverage map is the single requirement-level index, maintained under the same-change rule and enforced by `tests/security-coverage.test.ts`. | RESOLVED |
| F-5 | `SEC-SSRF-001` is discharged by the standing gate in section 5. `SEC-SSRF-002`, `SEC-SSRF-003`, and abuse case 10 are entered in the conditional registry with FW-603 as the absorbing task. | RESOLVED |
| F-6 | Amended. `SEC-AUTH-003` was genuinely unowned, and a cookie helper that ships insecure defaults is not a risk worth accepting when the alternative is naming a task. Section 9 creates FW-218 and the coverage map now points at it. | AMENDED |
| F-7 | `SEC-AUTH-004` is entered in the conditional registry rather than left pending, and its coverage-map row now says `conditional`. | RESOLVED |
| F-8 | `SEC-SECRET-004` and `SEC-SECRET-005` keep their weak owners. FW-114 and FW-115 must absorb source-map publication control and child-process environment minimization into their acceptance criteria when they become `READY`. No amendment: both tasks plainly contain the behavior, unlike F-6 where no task existed. | SCHEDULED |
| F-9 | `SEC-DOS-003` is absorbed by FW-206's acceptance criteria when it becomes `READY`. | SCHEDULED |
| F-10 | Amended. `AC-SEC-10` requires artifacts — `SECURITY.md`, a private reporting channel, a supported-version policy — that no task named. Section 9 creates FW-709 and makes FW-707 depend on it. | AMENDED |
| F-11 | `SEC-FILE-004` is entered in the conditional registry with FW-603 as the absorbing task. | RESOLVED |

## 9. Checklist amendments made by this task

Both amendments create a task for an obligation that already exists in a normative document. Neither invents a requirement, and neither decides a design.

**FW-218 — Secure cookie primitives** (M2, `P1`, depends FW-109, FW-110). Discharges `SEC-AUTH-003`: cookie helpers default to `HttpOnly`, `Secure`, and an explicit `SameSite`, with prefix and scope guidance. Placed in M2 because `SEC-AUTH-003` is a `P1` requirement whose coverage-map milestone is M2 and because FW-206 and FW-504 both assume cookie-authenticated requests exist. Without it, the first authorization and CSRF work would define cookie behavior implicitly.

**FW-709 — Vulnerability reporting and supported-version policy** (M7, `P0`, depends FW-008). Produces the public `SECURITY.md`, the private reporting channel, supported release lines with end-of-support dates, the severity rubric, the coordinated-disclosure policy, and the reporter-credit method required by `docs/09_SECURITY_PRD.md` section 24 and `AC-SEC-10`. FW-707 now depends on it, because section 26's v1 release-candidate gate requires the policy to be public before the candidate ships. The response-window table in section 24 stays an internal target; FW-709 must not publish it as a guarantee.

Neither amendment changes an existing task's outcome. FW-707's dependency list grows by one ID.

## 10. Enforcement

`tests/security-evidence-workflow.test.ts` asserts the mechanical parts of this document:

- Every accepted-risk record in the register has all ten mandatory fields, non-empty.
- Record IDs are unique and well formed; statuses come from the permitted set; `Review by` matches an ISO date, a milestone label, or a task-completion form.
- Every `SEC-*` requirement named by a record exists in the security PRD, and the priority quoted on the record matches the PRD.
- No record covering a `P0` requirement carries status `ACCEPTED`, enforcing section 6.3's approval limit.
- Every conditional requirement in section 5 exists in the PRD, is `P1`, cites a finding that FW-008 recorded, and names an absorbing task that exists in the checklist.
- Every coverage-map row marked `conditional` appears in section 5's registry, and no coverage-map row is left unowned.
- Every finding recorded by FW-008 has a disposition row in section 8 with a permitted state.
- Every task ID referenced by this document and by the register exists in the checklist.
- This document names all three evidence types, all four gate tiers, and all eight release-index sections.

What cannot be automated, and is therefore a named manual gate:

| Judgement | Gate |
|---|---|
| Whether a planned evidence type is adequate for a requirement | Boundary review under `docs/09_SECURITY_PRD.md` section 23, recorded on the security review template |
| Whether a rationale in an accepted-risk record is legitimate rather than schedule pressure | The approver named in section 6.3 |
| Whether a manual gate's procedure is genuinely reproducible by another person | Release manager at the prerelease gate |
| Whether interpretation I-1 is correct | Core maintainer confirmation; open until then |

## 11. Residual risk accepted at M0

- Interpretation I-1 is unconfirmed. It restricts `P0` accepted risks more tightly than a literal reading of section 7 requires. If a maintainer disagrees, this document changes, not the security PRD.
- No pull-request security gate is enforceable yet, so the workflow's per-change checks depend on discipline rather than automation until FW-117 and FW-120 land and until continuous integration executes at least once. FW-019 has since specified the dependency and license gates and wired them into the workflow and into `pnpm run verify`, which narrows this bullet without closing it.
- The register contains one record covering `P0` requirements that this agent may not approve; FW-019 renewed it rather than promoting it. It stays exposed rather than being quietly downgraded.
- The prerelease milestone check in section 7.2 is manual because no milestone has closed. It should be automated when M1 closes.
- Version control is still not initialized in this working copy, so `SEC-SUPPLY-002` and `SEC-SUPPLY-003` remain unexercised and continuous integration has never executed. That gap is now recorded as `AR-001` rather than repeated as prose in each task's residual risk.
