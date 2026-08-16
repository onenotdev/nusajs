# Strict Security Mode and Fail-Closed Policy

Task: FW-018. Date: 2026-08-16. Author: lead founding engineer (agent: GitHub Copilot, `gpt-pro`).

Governing documents: `docs/09_SECURITY_PRD.md` (normative for every rule here, in particular objectives SO-04 and SO-05, section 7, and section 26), `docs/00_MASTER_PRD.md` (NFR-011 and goal G5), `docs/02_ARCHITECTURE.md` (capability reporting and manifest versioning), `docs/06_COMPILER_AND_DEV_SERVER.md` (configuration, schema errors, diagnostics, development-server rules), `docs/08_DX_AND_OBSERVABILITY.md` (the diagnostic model), `docs/SECURITY_EVIDENCE_WORKFLOW.md` (what counts as evidence), `docs/SECURITY_THREAT_MODEL_APPROVAL.md` (the requirement-level coverage map), `docs/adr/ADR-008-security-manifest-and-strict-mode.md` (proposed; the configuration surface).

## 1. Purpose and authority

`docs/00_MASTER_PRD.md` states NFR-011: "Security controls fail closed for unsupported or invalid configurations." `docs/09_SECURITY_PRD.md` states objective SO-04: "Invalid or unsupported security configuration fails closed. Framework behavior must not silently downgrade protection." Neither says what "fails closed" means in a concrete case, which control fails, what a caller observes, or which relaxations are legitimate. Fourteen tasks are listed against NFR-011 in `docs/14_REQUIREMENTS_TRACEABILITY.md`, and without this document each would decide the question separately. That is the mechanism by which risk R-12 of `docs/13_POSITIONING_RISKS_AND_DECISIONS.md`, "security scope is treated as optional", is realized: not by a decision to drop a control, but by fourteen small independent judgements about what to do when a control cannot run.

This document is normative for those judgements. It has authority over what fail-closed means, over the form a relaxation must take, and over the severity a security diagnostic carries. It has no authority to change a `SEC-*` requirement, its priority, its owner, or a release gate; where it interprets a normative document the interpretation is marked and listed in section 10.

**An ADR does accompany this task, and it is not accepted.** `docs/13_POSITIONING_RISKS_AND_DECISIONS.md` reserves ADR-008 for "Security-manifest schema and strict-mode behavior" and states that a reserved ID is "not accepted authority until a corresponding ADR file has status `Accepted`". `docs/06_COMPILER_AND_DEV_SERVER.md` already publishes `security: { mode: "strict" }` in its configuration example, so the mode is a public configuration surface, and `AGENTS.md` requires a proposed ADR before implementation. `docs/adr/ADR-008-security-manifest-and-strict-mode.md` is therefore created as `Proposed`, and every clause of this document that depends on the mode's legal values, its default, or its effect on diagnostic severity is marked **conditional on ADR-008** and is not authority until that record is accepted.

This is the point where FW-018 differs from FW-008, FW-009, and FW-019. Those three were governance tasks with no public surface and correctly proceeded with no ADR. FW-018 is a governance task with one public surface, so it is split: the fail-closed rules in section 4 and the escape-hatch inventory in section 5 are requirement interpretation and take effect now, while the configuration property is deferred to ADR-008. No implementation is unblocked by this document, because no implementation exists; the first task that reads configuration is FW-103, and it must not start until ADR-008 is accepted.

## 2. Scope

In scope:

- What fail-closed means for a security control, as a closed set of rules.
- What a security control must do when its configuration is invalid, unknown, or unsupported.
- The complete inventory of relaxations that `docs/09_SECURITY_PRD.md` permits, the form each must take, and the diagnostic each must produce.
- The severity rule for security diagnostics, and the prohibition on suppressing them.
- The binding of these rules to the four release-gate tiers of `docs/09_SECURITY_PRD.md` section 26.

Out of scope, with the owning task named:

- The security-manifest schema and its field names — FW-107, recorded as part 2 of ADR-008.
- The configuration loader and the schema validator that enforce section 4 mechanically — FW-103.
- The diagnostic code namespace, the code format, and the formatters — FW-006 and FW-102.
- Every individual control's implementation and its own tests — the owning task named in section 5.
- Dependency, license, provenance, and publishing policy — FW-019, `docs/SUPPLY_CHAIN_POLICY.md`.
- Evidence qualification, invalidation, and the accepted-risk process — FW-009, `docs/SECURITY_EVIDENCE_WORKFLOW.md`.
- The public API audit that confirms no unsanctioned escape hatch shipped — FW-701.

## 3. Definitions

**Security control.** A framework behavior whose purpose is to satisfy a `SEC-*` requirement: an escape, a validation, a limit, a namespace, a redaction, a boundary check, a default header, or a build-time failure.

**Fail closed.** The control's protective outcome is preserved by refusing the operation, rather than by continuing with reduced protection. Refusal means a build failure, a request rejection, a thrown error, or an omitted response — never a silent continuation and never a repaired value.

**Fail open.** Any outcome in which the operation proceeds while the control's protection is absent, reduced, or unverified. Fail open is prohibited except through a relaxation that satisfies section 5.

**Relaxation.** A per-site, explicitly declared reduction of a control that a `SEC-*` requirement permits by name. A relaxation is legitimate only if it appears in section 5.

**Downgrade.** A reduction of a control that no requirement permits, or one taken without the declaration section 5 requires. A downgrade is prohibited, whether it happens by configuration, by fallback, by exception handling, or by a default.

## 4. The fail-closed rules

These rules apply to every security control in every package, adapter, and plugin. They are numbered so that a task's evidence can cite one.

**FC-1 — Refusal, not repair.** When a control's input is invalid, the control refuses the operation. It does not sanitize, coerce, truncate, re-encode, or otherwise repair the input into something acceptable. Repair hides the attacker's intent and makes the boundary untestable. Where a requirement explicitly asks for normalization — `SEC-INPUT-003` for URL normalization — normalization is the control and is applied before validation, not instead of it.

**FC-2 — Absence is the strict value.** When a security-relevant declaration is absent, the effective value is the most protective one, and the framework behaves as though it had been declared. Absence never means "unset", never means "inherit from a less strict scope", and never disables the control. `SEC-CACHE-001` is the model: a response with private dependencies and no declared cache policy is private, not uncached-and-therefore-public.

**FC-3 — An unknown value is an error, not a default.** An unrecognized value for a security-relevant configuration property fails the build. It does not fall back to the strict value, because a silent fallback turns a typo into an untested configuration and hides the fact that the author asked for something the framework does not have. The diagnostic states the property path, a description of the received value, and the legal set, per the schema-error rule in `docs/06_COMPILER_AND_DEV_SERVER.md`. Secret values are never printed.

**FC-4 — An unsupported capability fails the build.** When a control depends on a host capability that the adapter reports as `unsupported`, the build fails. When the adapter reports `emulated`, the build fails unless the application declares an explicit fallback, and the emulation is recorded in the security manifest. This is the security-specific reading of the rule in `docs/02_ARCHITECTURE.md` that "builds fail for unsupported required capabilities" and that "optional capabilities require an explicit fallback": for a security control there is no such thing as an optional capability, so the fallback must be declared rather than assumed.

**FC-5 — An unsupported schema version fails closed.** An adapter or runtime that receives a manifest whose major schema version it does not support rejects it and refuses to serve, rather than serving with the fields it recognizes. A partially understood security manifest is the worst case: the consumer believes it applied a policy it did not read.

**FC-6 — A control that cannot run refuses the operation.** If a control's dependency is missing at runtime — no secure random source, no crypto implementation, an unreachable cache namespace, an unavailable redaction sink — the operation the control protects is refused. It is never performed unprotected. `SEC-CRYPTO-002` admits no substitute for cryptographically secure randomness, so a missing source is a refusal and not a weaker source.

**FC-7 — An error inside a control is a closed outcome.** A thrown exception, rejected promise, timeout, or abort inside a control is treated as denial of the operation the control guards, never as absence of a finding. `catch` around a security check must not resume the protected path. This rule covers the most common accidental fail-open: a validation wrapped in error handling that returns a permissive default.

**FC-8 — A limit is exceeded, not stretched.** When a request, payload, depth, part count, or duration exceeds a configured limit, the operation is rejected and partial work is released. Limits are not raised at runtime, not raised by request content, and not bypassed for authenticated callers. `SEC-INPUT-002` requires conservative documented defaults; a default may be lowered by configuration and may be raised only by configuration, never by input.

**FC-9 — Ambiguity is refused.** When two declarations conflict and no rule chooses between them, the operation fails with a diagnostic naming both sources. The framework does not pick the last, the nearest, or the loosest. `SEC-HEADER-002` states the specific case — header merging "cannot silently weaken a stricter parent or platform policy. Conflicts produce diagnostics" — and this rule generalizes it: where a resolution order exists it may never resolve toward the weaker declaration.

**FC-10 — Degradation is refusal, not reduction.** Under resource pressure, shutdown, or partial failure, the framework stops accepting the protected work rather than performing it with controls skipped. `SEC-DOS-004` describes the shape: stop accepting new work, allow bounded in-flight completion, abort the remainder, close resources. Load shedding is a closed outcome.

### 4.1 Decision table

| Condition | Required outcome | Rule |
|---|---|---|
| A security-relevant configuration property has an unknown value | build failure with property path, received-value description, and legal set | FC-3 |
| A security-relevant declaration is absent | the most protective value applies as though declared | FC-2 |
| Untrusted input fails validation | reject the operation; do not repair the input | FC-1 |
| An adapter reports a required capability as `unsupported` | build failure | FC-4 |
| An adapter reports a required capability as `emulated` | build failure unless an explicit fallback is declared and recorded | FC-4 |
| A manifest major schema version is unsupported | reject the manifest and refuse to serve | FC-5 |
| A control's runtime dependency is unavailable | refuse the protected operation | FC-6 |
| A control throws, rejects, times out, or is aborted | treat as denial of the protected operation | FC-7 |
| A configured limit is exceeded | reject and release partial work | FC-8 |
| Two declarations conflict with no rule between them | fail with a diagnostic naming both sources | FC-9 |
| Resource pressure or shutdown | shed the protected work; never run it uncontrolled | FC-10 |
| A relaxation listed in section 5 is correctly declared | proceed, record it in the security manifest, emit the required diagnostic | section 5 |
| A reduction that section 5 does not list | prohibited; the change is a downgrade | section 3 |

## 5. The escape-hatch inventory

`docs/00_MASTER_PRD.md` goal G5 promises "safe defaults and explicit escape hatches", and SO-05 requires that unsafe escape hatches "produce visible diagnostics". This section is the complete inventory of relaxations that `docs/09_SECURITY_PRD.md` permits. It was derived by reading every one of the 63 `SEC-*` requirements and extracting each clause that admits an explicit exception; eleven requirements use the words "unless", "explicit", "override", "opt-in", or "relaxation" to permit one, and three more admit one through a named unsafe API, a configurable limit, or a recorded approval.

A relaxation not in this table does not exist. Adding a row requires the owning requirement to permit it in normative text; if the requirement does not, the change is a PRD amendment, not a task decision.

| Requirement | P | What may be relaxed | Required form of the opt-in | Required diagnostic | Owner |
|---|---|---|---|---|---|
| SEC-INPUT-002 | P0 | a specific limit's value | configuration only, per limit, never from request content | the effective value is inspectable; raising a default is recorded in the security manifest | FW-122 |
| SEC-XSS-001 | P0 | escaping, for raw HTML | an API whose name is explicitly unsafe, called per site | development warning at every call site | FW-112 |
| SEC-REQ-002 | P0 | rejection of unsafe cross-origin state-changing requests | explicit CORS and CSRF configuration, never a blanket allow | the configured origins are recorded in the security manifest | FW-504 |
| SEC-REQ-003 | P0 | open-redirect prevention | an explicit destination allowlist, or a per-call unsafe override | diagnostic naming the destination on every unsafe override | FW-207 |
| SEC-REQ-004 | P0 | ignoring proxy headers | an explicit trusted-proxy policy | the policy is recorded in the security manifest | FW-110 |
| SEC-AUTH-003 | P1 | cookie defaults `HttpOnly`, `Secure`, `SameSite`, path, domain | explicit per-cookie relaxation | diagnostic naming the cookie and the weakened attribute | FW-218 |
| SEC-CACHE-001 | P0 | private/no-store default for personalized responses | an explicit public-cache declaration | build and runtime warning when private dependencies are detected | FW-506 |
| SEC-SECRET-002 | P0 | explicit declaration of a public environment value | a supported naming convention, which does not remove the schema requirement | every exposed value is visible by name in the security manifest | FW-212 |
| SEC-SECRET-004 | P1 | withholding source maps from public output | an explicit deployment choice | the choice is recorded; private upload integrations may not write to public asset output | FW-114 |
| SEC-DEV-001 | P0 | loopback-only development binding | an explicit command-line flag | warning that lists the accessible URLs | FW-121 |
| SEC-SUPPLY-005 | P1 | the deny-by-default on dependency install scripts | a recorded approval by a named maintainer | the approval record itself, per `docs/SUPPLY_CHAIN_POLICY.md` section 4.1 | FW-019 |
| SEC-SUPPLY-006 | P1 | confinement of plugin output to declared roots | an explicit user grant of a broader path | the granted path is recorded in the security manifest | FW-602 |
| SEC-SSRF-003 | P1 | withholding credentials across origins and redirects | explicit configuration | diagnostic naming the destination origin | FW-603 |
| SEC-OBS-004 | P1 | the no-network default for product telemetry | explicit opt-in, with the payload inspectable before transmission | the opt-in state and the payload are inspectable | FW-607 |

Three properties are common to every row and are the definition of an acceptable escape hatch:

1. **Local.** The relaxation applies at the site that needs it — one call, one cookie, one route, one destination, one limit — and never application-wide. There is no value of any configuration property that relaxes more than one row at once, and ADR-008 proposes to keep it that way.
2. **Named.** The relaxation names what it relaxes. An allowlist names destinations; an unsafe API names itself; a public-cache declaration names the route.
3. **Visible.** The relaxation produces a diagnostic, a manifest entry, or a recorded approval, so that `SEC-SECRET-002`'s rule — every exposed value is visible by name — generalizes to every relaxation.

**Interpretation I-2.** `SEC-INPUT-002` and `SEC-SECRET-002` are read as escape hatches. A configurable limit is a relaxation of a documented conservative default, and a naming convention is a relaxation of the explicit-declaration requirement; both are constrained by the same three properties. Listed for maintainer confirmation in section 10.

## 6. Severity and suppression

`docs/06_COMPILER_AND_DEV_SERVER.md` gives a diagnostic three severities, `error`, `warning`, and `info`. Neither that document nor `docs/08_DX_AND_OBSERVABILITY.md`, which owns error presentation and observability, describes any mechanism for suppressing one. That silence is treated as deliberate and made explicit here.

- A security diagnostic is `error` when the condition it reports means a control did not run or cannot run. Every outcome in the section 4.1 table that fails the build or refuses an operation carries `error`.
- A security diagnostic is `warning` when a control ran, the outcome is safe, and a correctly declared relaxation reduced protection at that site. The relaxations in section 5 produce warnings, not errors, because the author declared them.
- A security diagnostic is `warning` when a risk is detected but its safety depends on application context the framework cannot see — for example a public-cache declaration on a route whose loader reads a cookie, the `SEC-CACHE-001` case.
- No security diagnostic is `info`. `info` is for facts, and every condition in this document is either a failure or an accepted reduction.
- **No mechanism suppresses a security diagnostic.** There is no ignore comment, no severity-override configuration, no allowlist of diagnostic codes, and no global switch. A warning is silenced only by removing the relaxation that produced it. A plugin may not suppress one — `docs/07_ADAPTERS_AND_PLUGINS.md` already forbids a plugin to "disable security diagnostics" — and neither may configuration.
- Whether a future non-strict mode changes any of this is **conditional on ADR-008**. In v0.x, with one mode, the mode changes no severity.

The reason for the prohibition is the prerelease gate in `docs/09_SECURITY_PRD.md` section 26, "security diagnostics contain no unresolved P0 issue". A suppression mechanism would make that gate unenforceable while appearing to pass, which is precisely the silent downgrade SO-04 forbids.

## 7. Gate bindings

| Gate tier | Condition this document supplies | Mechanism | Status |
|---|---|---|---|
| Every pull request | a new or changed control fails closed per section 4 and cites the rule | `templates/SECURITY_REVIEW_TEMPLATE.md`, checked by the pull-request approver | manual gate, active immediately |
| Every pull request | no new relaxation exists outside the section 5 inventory | code review plus `tests/strict-security-mode.test.ts` for the documentary half | partly mechanical; the code half needs FW-701 |
| Every prerelease | security diagnostics contain no unresolved P0 issue | requires the diagnostic model, FW-102, and a diagnostic surface to query | not enforceable; no diagnostic exists yet |
| Every prerelease | every active relaxation appears in the security manifest | requires FW-107 | not enforceable; no manifest exists yet |
| v1 release candidate | the shipped public API contains no escape hatch absent from section 5 | FW-701 public API and security surface audit | specified; unexercised |
| v1 release candidate | no suppression mechanism for a security diagnostic exists in the public API | FW-701, and the independent audit FW-703 | specified; unexercised |

No condition in this table has ever executed, for the same reason recorded in `docs/SUPPLY_CHAIN_POLICY.md` section 13: no continuous-integration run has been observed, and no framework code exists to gate. Under `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.1 a specified gate is not evidence.

## 8. What this document discharges, and what it does not

This document defines policy. It implements no control, so under `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.2 it discharges no `SEC-*` requirement and every row of section 5 remains an obligation on the named owner.

What it does discharge is narrower and belongs to the product requirements, not the security requirements: NFR-011 of `docs/00_MASTER_PRD.md` acquires a definition, a closed rule set, and a decision table, so the fourteen tasks listed against it in `docs/14_REQUIREMENTS_TRACEABILITY.md` inherit one answer instead of inventing fourteen. Objectives SO-04 and SO-05 acquire the same. AC-SEC-01's requirement that every P0 requirement map to a test or a documented release gate is unaffected: this document adds no coverage row and claims no owner.

The relationship to the coverage map is deliberate. `docs/SECURITY_THREAT_MODEL_APPROVAL.md` names FW-018 in exactly one place, section 1.1, as an exclusion from FW-008's scope, and no coverage row names FW-018 as an owner. That stays true. Amendment A-3 records this document's existence against the requirements it constrains without transferring ownership, because a policy that reassigned fourteen owners to itself would make the coverage map say that FW-018 tests controls it does not implement.

## 9. Enforcement

`tests/strict-security-mode.test.ts` asserts the mechanical parts of this document:

- Every fail-closed rule declared in section 4 appears in the section 4.1 decision table, and every rule cited by the table is declared.
- Every `SEC-*` requirement named by this document exists in `docs/09_SECURITY_PRD.md`, and the priority quoted in section 5 matches the priority the PRD gives it.
- Every requirement in the section 5 inventory contains, in its normative PRD text, a clause that permits an exception; a row whose requirement admits none is a fabricated escape hatch.
- Every escape-hatch row names a form of opt-in, a required diagnostic, and an owning task that exists in `CHECKLIST.md`.
- Every `FW-` identifier referenced by this document exists in `CHECKLIST.md`.
- The three severity rules and the suppression prohibition are present, and neither `docs/06_COMPILER_AND_DEV_SERVER.md`, which owns the diagnostic shape and the configuration surface, nor `docs/08_DX_AND_OBSERVABILITY.md`, which owns error presentation, mentions suppressing or ignoring a diagnostic.
- ADR-008 exists as a file, its status is one of the permitted ADR statuses, it is referenced from the reserved-decision list in `docs/13_POSITIONING_RISKS_AND_DECISIONS.md`, and while its status is `Proposed` this document marks its mode-dependent clauses conditional.
- The interpretations in section 10 are numbered and do not collide with the interpretation numbering in `docs/SECURITY_EVIDENCE_WORKFLOW.md`.

What cannot be automated, and is therefore a named manual gate:

| Judgement | Executing role |
|---|---|
| Whether a proposed control's failure mode is genuinely closed rather than closed-looking | pull-request approver, not the author |
| Whether a new relaxation belongs in section 5 or is a downgrade | core maintainers, as a PRD or ADR decision |
| Whether a declared fallback for an `emulated` capability is adequate | pull-request approver, recorded in the review |
| Whether a diagnostic's severity matches section 6 | pull-request approver |
| Whether the shipped public API contains an unlisted escape hatch | FW-701, then the independent auditor FW-703 |
| Whether ADR-008 part 1 is accepted | core maintainers; no agent may accept it |

## 10. Interpretations requiring maintainer confirmation

**I-2.** `SEC-INPUT-002`'s configurable limits and `SEC-SECRET-002`'s permitted naming convention are treated as escape hatches subject to the three properties in section 5. Neither requirement calls itself an escape hatch. If the maintainers disagree, the two rows leave section 5 and the requirements keep their own wording as their only constraint.

**I-3.** The absence of a suppression mechanism from `docs/06_COMPILER_AND_DEV_SERVER.md` and `docs/08_DX_AND_OBSERVABILITY.md` is read as a prohibition rather than an omission. If the maintainers intend suppression to be possible, section 6 must be amended and the prerelease gate "security diagnostics contain no unresolved P0 issue" needs a definition of "unresolved" that survives suppression.

**I-4.** FC-4's treatment of `emulated` capabilities is stricter than `docs/02_ARCHITECTURE.md`, which requires an explicit fallback for optional capabilities generally. This document holds that a security control has no optional capabilities, so an `emulated` capability needs a declared fallback even where the general rule would allow a default. The stricter reading is deliberate and is left in place.

Interpretation numbering continues from `docs/SECURITY_EVIDENCE_WORKFLOW.md`, which holds I-1.

## 11. Residual risk accepted at M0

- ADR-008 is `Proposed`, not `Accepted`. The mode's legal values, its default, and its relationship to diagnostic severity are undecided, so a reader must consult two documents and the conditional clauses cannot be relied on. No agent may accept the ADR.
- Part 2 of ADR-008, the security-manifest schema, is deliberately undecided. Every "recorded in the security manifest" cell in section 5 names an obligation whose destination does not exist until FW-107.
- Nothing in section 4 is enforced by code, because no framework code exists. The rules are enforced today only by review and by the documentary assertions in `tests/strict-security-mode.test.ts`, which check that the policy is self-consistent, not that any control obeys it.
- Section 5 is complete with respect to `docs/09_SECURITY_PRD.md` as it stands on 2026-08-16. A new requirement, or an amendment to an existing one, can add a permitted exception, and the same-change rule of `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 4 is the only thing that keeps the inventory current.
- The extraction that produced section 5 read requirement text for exception-permitting clauses. A requirement that permits an exception without using such a clause would have been missed; the mechanical check in section 9 detects a fabricated row but cannot detect a missing one. FW-701's public API audit is the compensating control.
- Two of the fourteen rows, `SEC-SSRF-003` and one half of `SEC-FILE-004`'s subject matter, belong to requirements that `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 5 records as conditional. Their escape hatches are specified before the integrations that would use them exist, so the specification is untested against a real case.
- The prohibition in section 6 is the clause most likely to be attacked later, because the first team blocked by a security warning it considers a false positive will ask for a suppression mechanism. This document deliberately offers no pressure valve, which raises the chance the rule is amended under pressure rather than on merit.
- No gate in section 7 has ever executed. `AR-001` already covers the general case — no continuous-integration run has been observed — and this task does not renew it again, because FW-019 renewed it and `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 6.4 permits only two renewals before escalation to the core maintainers.
