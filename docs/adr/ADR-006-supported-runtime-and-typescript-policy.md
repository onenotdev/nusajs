# ADR-006: Supported runtime and TypeScript policy

- Status: Accepted
- Date: 2026-08-17
- Owner: Lead founding engineer (agent: GitHub Copilot, `gpt-pro`) under delegated autonomy
- Related tasks: FW-005, FW-101, FW-113, FW-115, FW-117, FW-214, FW-709
- Security impact: medium

## Context

The repository currently states three different Node versions in three places and reconciles them nowhere.

| Location | Statement |
|---|---|
| `package.json` | `"engines": { "node": ">=20.19.0" }` |
| `.github/workflows/ci.yml` | `node-version: 22` |
| `docs/adr/ADR-005-monorepo-and-toolchain.md` | "Verified local toolchain: Node.js v24.16.0" |

None is wrong on its own terms — a declared floor, a gated version, and a development environment are three different things — but together they mean the project cannot answer "which Node versions do you support" without guessing. Worse, the declared floor `20.19.0` names a line whose upstream support ended on 2026-04-30, so the one statement a consumer's package manager actually reads is the one advertising an unpatched runtime.

TypeScript is in a similar state by a different route. `docs/00_MASTER_PRD.md` `NFR-002` and `AGENTS.md` both require strict mode, and `tsconfig.base.json` implements it thoroughly, but no document names a minimum compiler version. `docs/11_TESTING_AND_QUALITY.md` promises a "documented supported range plus informational canary testing" without saying what the range is. The effective answer is the pinned devDependency, 5.9.3, which is a fact about this repository rather than a policy for consumers.

`docs/13_POSITIONING_RISKS_AND_DECISIONS.md` reserves this decision as ADR-006 and marks it required before M1. `CHECKLIST.md` FW-101, the first M1 task, depends on FW-005, so the kernel's public API boundary cannot be built until this is settled: the floor decides which platform APIs the adapter and tooling layers may assume, and the TypeScript range decides which compiler options may appear in the shipped declarations.

`docs/11_TESTING_AND_QUALITY.md` also lists browsers in the same platform matrix. That is not in scope here. It is ADR-012, and `docs/11_TESTING_AND_QUALITY.md` requires it before v1 rather than before M1.

## Decision drivers

1. **A declared floor is a security statement.** `engines.node` is machine-read. Naming an end-of-life line tells every consumer's tooling that an unpatched runtime is acceptable.
2. **The three statements must be derivable from one rule.** Any policy that leaves them independent will drift again.
3. **`docs/07_ADAPTERS_AND_PLUGINS.md` fixes the ordering.** "Introduced only after Node conformance is stable. Universal packages do not change to accommodate them." Node is the baseline; Bun and Deno cannot be co-primary.
4. **`NFR-001` forbids Node built-ins in universal packages.** The floor therefore governs the adapter and tooling layers only, and must not be read as permission for core to use platform APIs.
5. **`NFR-010` requires ESM as the primary distribution format,** which makes CommonJS consumers' ability to `require` an ESM package a support question rather than a packaging detail.
6. **`docs/09_SECURITY_PRD.md` section 24 requires published end-of-support dates and forbids overstating them:** "Do not publish target windows as guarantees until the maintainer team can sustain them." A two-person project must state a shape it can keep.
7. **`docs/11_TESTING_AND_QUALITY.md` makes canary compiler testing informational.** A pre-release TypeScript must not be able to block a merge.
8. **Supported must mean gated.** `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.1 holds that an unexecuted gate is not evidence; the same logic applied to platforms means an ungated platform has no support evidence.

## Options

Four options were compared for the Node floor. The TypeScript range and the support-window shape are treated as sub-decisions of the chosen option because they are not independently contentious; the disagreement is entirely about the floor.

### Option A — Keep the widest floor: oldest line that ever reached LTS, currently `>=20.19.0`

Leave `package.json` as it is and gate CI on the floor.

- Largest addressable audience; no consumer is excluded today.
- Requires no change, which is its main attraction and also its main problem.
- **Disqualifying:** 20.x reached upstream end-of-life on 2026-04-30. Supporting it means testing against a runtime that no longer receives security patches, and advertising it in `engines.node` means telling consumers' tooling that this is fine. `docs/09_SECURITY_PRD.md` section 24 requires published support lines to be truthful, and section 7 requires `P0` supply-chain requirements to have real evidence; a green test run on an unpatched runtime is evidence of the wrong thing.
- Also forces every adapter and tool to code to 20.x APIs, and makes unflagged `require(esm)` unavailable, which conflicts with driver 5.

### Option B — Floor at the oldest Node line still inside its official support window

Derive the floor from the upstream schedule: as of 2026-08-17 that is 22.x, minimum `22.12.0`. Gate CI on every supported major. Drop a line when upstream ends it.

- The floor is derived, not chosen, so it cannot drift: one rule produces `engines.node`, the CI matrix, and the documentation table.
- Never supports an unpatched runtime, satisfying drivers 1 and 6.
- Two majors in the matrix (22, 24) is affordable CI cost.
- Excludes 20.x consumers, which is a real cost — but they are on an end-of-life runtime and the honest response is to say so rather than to accommodate it.
- Requires a stated review cadence, since the rule depends on dates that move.
- The 22.12.0 minor is chosen for a stated reason (unflagged `require(esm)`), not for recency, which keeps driver 5 satisfied without inventing a newer floor.

### Option C — Floor at the current LTS only, currently `>=24.x`

Support exactly one line: the newest LTS.

- Simplest matrix, newest APIs, one target for performance baselines.
- Cheapest CI.
- **Rejected:** excludes 22.x, which is inside its support window until 2027-04-30 and is what a conservative production deployment is most likely to be running. It would also make every Node LTS transition a breaking change on a fixed 12-month cadence regardless of whether anything in the project needed it, which is a compatibility cost with no corresponding benefit. Driver 6 asks for a sustainable promise; a floor that rises annually by construction is sustainable for the maintainers and hostile to consumers.

### Option D — No floor: support anything that passes the suite

Remove `engines.node` and let the test results define support.

- Zero policy maintenance.
- **Rejected:** inverts driver 8. It makes support a post-hoc observation rather than a commitment, so no consumer can plan and no release note can state what changed. It also removes the only machine-readable signal a consumer's package manager can act on, and it would silently "support" odd-numbered lines that reach end-of-life within months.

## Decision

**Option B.** The supported-runtime and TypeScript policy is `docs/SUPPORT_POLICY.md`, and the following are binding commitments.

**C1 — The Node floor is the oldest LTS line still inside its official upstream support window.** As of 2026-08-17 that is `22.12.0`. `package.json` `engines.node` is set to `>=22.12.0`, which raises it from `>=20.19.0` and removes the end-of-life claim. The minor `22.12.0` rather than `22.0.0` is fixed because unflagged `require(esm)` first appears there, and `NFR-010`'s ESM-only distribution would otherwise depend on a runtime flag the project does not control.

**C2 — The floor, the CI matrix, and the documented table are one fact stated three times, and a test enforces their agreement.** `tests/support-policy.test.ts` asserts that the floor in `docs/SUPPORT_POLICY.md` section 3.1 equals `engines.node`, and that every Node major marked supported there appears in the CI matrix. The three-way drift this ADR exists to fix cannot silently return.

**C3 — Node 24.x is the primary line.** Diagnostics, performance baselines, and reproducibility artifacts are produced there so that two artifacts are comparable by default. Primary is not a support tier; 22.x is equally supported.

**C4 — A supported line is dropped only when upstream ends it.** Dropping is permitted in a minor release in that case, because continuing to advertise an unpatched runtime is a worse defect than the compatibility break. Raising the floor for convenience requires an ADR superseding this one.

**C5 — Node is tier 1 alongside static output; edge runtimes reached through an adapter are tier 2; Bun and Deno are tier 3 and may not be described as supported.** A tier-1 failure blocks the release. A tier-2 failure blocks that adapter only. Tier 3 has no gate and therefore no support claim. Promotion out of tier 3 is a core-maintainer judgement, not an agent's.

**C6 — The TypeScript floor is 5.8 and the supported range runs from the floor through the latest stable release.** The floor is derived from the artifacts, not preferred: `tsconfig.base.json` sets `erasableSyntaxOnly`, which does not exist before 5.8. A consumer below the floor cannot type-check against the shipped declarations. The floor rises only when a needed option or syntax requires it, and the need is stated in the release note.

**C7 — Pre-release TypeScript is informational.** `beta`, `rc`, and `next` are tested for advance warning and may not block a merge, per `docs/11_TESTING_AND_QUALITY.md`.

**C8 — Emitted types are public API.** A type-level break is a break under semantic versioning, including a narrowing that changes no runtime behaviour. `skipLibCheck` is enabled for this repository's own builds and may not be relied on by the published packages' correctness claim; the public type surface is checked by the FW-701 API report.

**C9 — pnpm is primary and gated; npm is compatibility-only; modern Yarn is smoke-level.** Workspace development is supported on pnpm alone. Installing and building a generated project must work on npm.

**C10 — End-of-support windows are published as a shape, not yet as a guarantee.** The current major is supported while current. The previous major receives security fixes only, targeting six months after its successor's stable release, and that window is an internal target until the maintainer team has executed one backport cycle. This is the direct application of section 24's "do not publish target windows as guarantees until the maintainer team can sustain them." FW-709 owns publishing them in `SECURITY.md`.

**C11 — Browser support is out of scope and belongs to ADR-012.** No client-runtime baseline may be inferred from the Node floor.

## Consequences

Positive:

- The project can answer "which runtimes do you support" with one sentence and a derivation rule, and a test fails if the answer stops being true.
- `engines.node` stops advertising an end-of-life runtime.
- FW-101 is unblocked with a known platform baseline, and FW-117's boundary scanner has an unambiguous statement that the floor does not license Node built-ins in universal packages.
- The Bun/Deno question is settled as a tier assignment rather than relitigated per task.

Negative and honest:

- Consumers on Node 20 are excluded as of this ADR. That is a real audience cost, incurred deliberately.
- The policy depends on upstream dates that age. Section 2 of `docs/SUPPORT_POLICY.md` sets a review cadence, but that cadence is a process control with no automated trigger. Nothing fails if a reviewer skips a milestone boundary; the table simply becomes stale, and stale here means a false support claim.
- Two supported Node majors across three operating systems is six tier-1 job combinations, up from three. CI cost doubles, and a flaky platform now has twice the surface to be flaky on.
- The TypeScript floor of 5.8 is not exercised. Nothing type-checks against 5.8; the repository builds on 5.9.3. The floor is derived from which release introduced the options in use, which is sound reasoning about the artifacts but is not a measurement.
- The npm and Yarn tiers cannot be gated yet because no generated project exists to install. They are stated intent until FW-115 and FW-215 land.

What becomes harder:

- Adopting a Node API available only in 24.x now requires either an adapter-layer feature check or an ADR raising the floor. Under Option C it would have been free. This is the intended trade: the friction is what keeps the floor from drifting upward without a reason.
- Every future release note that changes a supported line must touch four artifacts. C2 makes three of them mechanical, which reduces the cost but does not remove it.

## Security analysis

- `SEC-SUPPLY-002` (`P0`) — locked dependencies, vulnerability scanning, secret scanning, license checks, provenance. This ADR does not discharge it. It constrains it: C2 makes the CI matrix a function of the claimed support set, so a supported platform cannot go unscanned while remaining advertised. The failure mode this closes is a platform-specific optional dependency that is never audited because no job runs on that platform.
- `SEC-SUPPLY-003` (`P0`) — release artifacts from controlled CI. Same relationship. The supported-version set defines what "controlled CI" must cover; a matrix narrower than the claim produces artifacts for an unbuilt platform.
- `SEC-SUPPLY-001` (`P0`) — do not describe a weaker guarantee as a stronger one. C5's tier 3 rule is the same reasoning: a runtime with no gate has no evidence and may not be called supported. Calling Bun "supported" because it happens to run the suite locally would be the platform equivalent of describing metadata permissions as a sandbox.
- `docs/09_SECURITY_PRD.md` section 24 — required to publish supported lines and end-of-support dates, forbidden to overstate them. C10 satisfies both halves by separating the shape from the promise. The most likely way to violate section 24 is optimism, not omission, which is why the previous-major window is explicitly marked a target.
- `docs/02_ARCHITECTURE.md` capability states and `docs/STRICT_SECURITY_MODE.md` rule FC-10 — tier 2 obliges an adapter to declare `supported`, `emulated`, or `unsupported` rather than degrade silently. Section 1 rule 4 of the policy states this as a condition of the word "supported".
- Removing `>=20.19.0` is itself the security-relevant change in this ADR. The abuse case is not an attacker payload; it is a consumer deploying onto an end-of-life runtime because the project's own metadata told them it was fine.

Residual risk: the review cadence in section 2 of the policy is manual and unowned by any automated gate, so the support table can become false without any test failing. This is disclosed here and in the policy's section 10; per `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.2 a residual-risk sentence is a disclosure and not an accepted risk, so no `SEC-*` requirement is discharged by it. Converting the cadence into a scheduled CI check that compares the table against the upstream schedule is available future work and belongs to whichever task next owns the workflow file.

## Verification

- `docs/SUPPORT_POLICY.md` is the policy; `tests/support-policy.test.ts` enforces it.
- The mechanical assertions: the section 3.1 floor equals `package.json` `engines.node`; every Node major marked supported in section 3.1 appears in `.github/workflows/ci.yml`; the TypeScript floor is not greater than the pinned `devDependencies.typescript`; every `FW-`, `SEC-`, `AC-`, `NFR-`, and `ADR-` identifier cited by the policy and this ADR resolves to a real record; browser support is explicitly deferred to ADR-012; this ADR follows `templates/ADR_TEMPLATE.md` and is `Accepted`.
- `pnpm run verify` runs format, lint, type check, tests, dependency audit, and license gate.

Known limitations of the verification, stated rather than implied:

- `.github/workflows/ci.yml` now pins the tier-1 matrix to `22.12.0` and `24` across three operating systems, so the floor is exercised rather than only asserted — but only once CI actually runs. No run has been observed from this environment, so C1 is a defined gate and not yet executed evidence.
- No job executes against TypeScript 5.8, so C6 is a derivation from which release introduced `erasableSyntaxOnly`, not a measurement. The floor is a claim about the shipped declarations' minimum readable compiler.
- The informational canary job for C7 is defined and, per `continue-on-error`, cannot block a merge. It has likewise never executed.
- CI itself has never been observed executing from this environment. `AR-001` in `docs/SECURITY_ACCEPTED_RISKS.md` covers that gap and is amended by this task, because its stated scope — that version control is not initialized — is no longer true.

## Rollback or supersede plan

The floor rule is the only load-bearing part. A superseding ADR may:

- **Widen the floor** back toward Option A. This requires accepting an end-of-life runtime and therefore an accepted-risk record over `SEC-SUPPLY-002` approved by a named human maintainer, since `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 6.3 forbids an agent from approving a `P0` risk.
- **Narrow to Option C.** Cheaper and requires no security exception; it is a compatibility decision and a major release.
- **Promote Bun or Deno out of tier 3.** Requires the core-maintainer judgement that tier 1 conformance is stable, and may not change any universal package, per `docs/07_ADAPTERS_AND_PLUGINS.md`.

Rollback is mechanically cheap while no packages are published: `engines.node`, the CI matrix, the section 3.1 table, and the enforcing test are four edits, and C2's test makes an incomplete rollback fail rather than pass. After the first publish, a floor change is a breaking change under section 6 of the policy and requires a major release plus migration guidance.
