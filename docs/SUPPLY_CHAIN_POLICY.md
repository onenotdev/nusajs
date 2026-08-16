# Dependency, License, Provenance, and Publishing Policy

Task: FW-019. Date: 2026-08-16. Author: lead founding engineer (agent: GitHub Copilot, `gpt-pro`).

Governing documents: `docs/09_SECURITY_PRD.md` (normative for security and privacy, sections 15, 23, 26, and 27), `docs/11_TESTING_AND_QUALITY.md` (pull-request gate 8), `docs/12_ROADMAP_AND_RELEASES.md` (release channels and governance), `docs/SECURITY_EVIDENCE_WORKFLOW.md` (what qualifies as evidence and how a deferral is recorded), `docs/SECURITY_THREAT_MODEL_APPROVAL.md` (the FW-008 coverage baseline), `docs/adr/ADR-005-monorepo-and-toolchain.md` (the accepted toolchain).

## 1. Purpose and authority

`docs/09_SECURITY_PRD.md` section 15 states the requirements this document operationalizes:

> `SEC-SUPPLY-002` [P0] — Official packages use locked dependencies, automated vulnerability scanning, secret scanning, license checks, and release provenance supported by the registry/toolchain.

> `SEC-SUPPLY-005` [P1] — Dependency additions require maintenance, ownership, download-script, transitive-risk, and license review. Dependencies with install scripts require explicit approval.

ADR-005 accepted the toolchain and deferred this work explicitly: *"Dependency additions remain subject to the policy work in FW-019."* This document supplies the policy, the definitions the gates in `docs/09_SECURITY_PRD.md` section 26 refer to but do not define, and the commands that produce the evidence.

This document is procedural and normative for supply-chain process. It has authority over which scanners run, what their output means, what blocks a merge or a release, and how a dependency is admitted. It has no authority to change a `SEC-*` requirement, its priority, or a release gate.

No ADR accompanies this task. FW-019 introduces no public API and selects no architecture: it defines policy over a toolchain that ADR-005 already accepted, and no reserved ADR ID in `docs/13_POSITIONING_RISKS_AND_DECISIONS.md` covers dependency, license, provenance, or publishing policy. Section 9 records a trust boundary that `docs/09_SECURITY_PRD.md` section 6 omitted; recording an omitted boundary is not a new decision, and the requirements that govern it already exist.

## 2. Scope

In scope: the dependency inventory, the dependency-addition review, install-script approval, the license allow list, vulnerability scanning and the definition of a blocking finding, lockfile and pinning rules, release provenance, controlled-CI publishing, the publish dry run, the release-artifact trust boundary, and the binding of all of this to the pull-request and release gates.

Out of scope, with the owning task named so nothing here is mistaken for a discharge of it:

- Canary-secret scanning infrastructure and the client-bundle, manifest, and log scans that use it — FW-120. Section 6.4 states the interim position and does not claim the gate is enforced.
- Plugin lifecycle, client-injection, capability, output-root, network, and telemetry declarations (`SEC-SUPPLY-004`) — FW-602 and FW-603. This document reviews the packages the framework depends on, not the plugins an application loads.
- The documentation stating that plugins execute trusted code and that metadata is not a sandbox (`SEC-SUPPLY-001`) — FW-601 and FW-609.
- Plugin output-path canonicalization (`SEC-SUPPLY-006`) — FW-602.
- Strict security mode and fail-closed behavior — FW-018.
- The public `SECURITY.md`, the private reporting channel, supported release lines, and the severity rubric — FW-709. Section 6.3 uses the rubric in `docs/09_SECURITY_PRD.md` section 24 as an internal target and publishes nothing.
- The independent pre-v1 security review and the final release-candidate verification — FW-703 and FW-707. Nothing in this document satisfies either.
- The universal-package boundary scan — FW-117.
- The supported runtime and TypeScript support policy, which ADR-006 will decide — FW-005.

## 3. Inventory as of this task

Measured on 2026-08-16 with `pnpm licenses list --json` and `pnpm licenses list --dev --json`.

| Scope | Runtime dependencies | Development dependencies | Transitive packages | Distinct licenses |
|---|---|---|---|---|
| Workspace root | 0 | 4 | 68 | 6 |
| `spikes/renderer-evaluation` | 0 | 6 | measured separately, never published | subset of the same 6 |

Root development dependencies, each pinned exactly:

| Package | Version | License | Source repository | Install script |
|---|---|---|---|---|
| `@biomejs/biome` | 2.3.11 | MIT OR Apache-2.0 | `github.com/biomejs/biome` | none granted |
| `@types/node` | 24.10.1 | MIT | `github.com/DefinitelyTyped/DefinitelyTyped` | none |
| `typescript` | 5.9.3 | Apache-2.0 | `github.com/microsoft/TypeScript` | none |
| `vitest` | 3.2.7 | MIT | `github.com/vitest-dev/vitest` | none |

The framework itself has no runtime dependency, and `NFR-006` keeps that the default rather than an accident. A runtime dependency in a published `@nusajs/*` package requires the review in section 4 plus a maintainer decision recorded in the pull request, because it becomes a dependency of every consuming application.

## 4. Dependency-addition policy

Every new dependency, and every change of an existing dependency to a new major version, requires the five reviews below. The reviewer records the outcome in the pull-request description under the heading `Dependency review`. A dependency added without a recorded review is a gate failure under section 10, not a style problem.

| Review | What is recorded | Rejection condition |
|---|---|---|
| Maintenance | last release date, release cadence, open critical issues, whether the project states a security-reporting channel | unmaintained, or no way to report a vulnerability |
| Ownership | the publishing organization or account, the source repository, whether the published tarball is built from that repository in public CI | ownership cannot be established, or the package name is a plausible typosquat of a more popular package |
| Install and download script | whether the package or any transitive package declares `preinstall`, `install`, `postinstall`, or `prepare`, and whether any script downloads a binary at install time | an install script is present and no explicit approval is granted under section 4.1 |
| Transitive risk | the added transitive package count, the deepest new subtree, any duplicated major version, any package with a single maintainer in the new subtree | the transitive cost is disproportionate to the value, judged by the reviewer and stated in the record |
| License | the declared license of the package and of every newly added transitive package, checked against section 5 | any license outside the allow list without a recorded exception |

The reviewer is the pull-request approver, who must not be the author. Under delegated autonomy an agent may perform and record the review, but a runtime dependency of a published package additionally requires a human maintainer, because `docs/12_ROADMAP_AND_RELEASES.md` reserves security-sensitive changes to maintainers.

A dependency is preferred over first-party code only when it is smaller than the code it replaces, or when correctness is hard to achieve independently — cryptography being the standing example, since `AGENTS.md` forbids implementing our own.

### 4.1 Install-script approval

Install scripts are denied by default. `pnpm-workspace.yaml` carries the deny list as `allowBuilds`, and `tests/workspace-skeleton.test.ts` fails if any entry is set to `true`, so an approval cannot be added silently.

Granting one requires all of: the script's source read and quoted in the approval record; a statement of what it writes and what network access it performs; a statement of why the package is unusable without it; and the approving maintainer named. The current repository grants none. `esbuild` is denied with the reason recorded inline in `pnpm-workspace.yaml`.

## 5. License policy

A package may be installed only if its declared license appears below as `allowed`, or if it carries a recorded exception. The list is machine-readable: `scripts/check-licenses.mjs` parses this table and compares it against `pnpm licenses list --json`, so the policy and its enforcement cannot drift.

| License | Status |
|---|---|
| `MIT` | allowed |
| `Apache-2.0` | allowed |
| `ISC` | allowed |
| `BSD-2-Clause` | allowed |
| `BSD-3-Clause` | allowed |
| `BlueOak-1.0.0` | allowed |
| `0BSD` | allowed |
| `CC0-1.0` | allowed |
| `Python-2.0` | allowed |
| `MIT OR Apache-2.0` | allowed |
| `(MIT OR Apache-2.0)` | allowed |
| `Apache-2.0 WITH LLVM-exception` | allowed |

A disjunctive expression is allowed when every alternative it offers is allowed, because the consumer may elect any of them. A conjunctive expression joined by `AND` is treated as its most restrictive term and is not covered by the table above.

Denied without exception, in any package that ships in or is required by a published `@nusajs/*` package: `GPL-*`, `AGPL-*`, `LGPL-*`, `SSPL-*`, `BUSL-*`, any source-available or non-commercial license, `UNLICENSED`, and any package publishing no license field. A copyleft license in a development-only dependency still requires an exception, because a development tool can be linked into generated output by mistake.

An exception is recorded as a row with status `exception: <reason>` and requires a named maintainer. There are none today.

## 6. Vulnerability and secret scanning

### 6.1 What runs

| Scanner | Command | Trigger | Evidence |
|---|---|---|---|
| Vulnerability | `pnpm run deps:audit` | every pull request, and nightly | scanner exit code and captured advisory list |
| License | `pnpm run deps:licenses` | every pull request | checker exit code and the offending package list on failure |
| Lockfile integrity | `pnpm install --frozen-lockfile` | every pull request | install exit code |
| Secret | owned by FW-120; see section 6.4 | not yet enforced | none today |

Local and CI commands are identical, as ADR-005 requires. `pnpm run deps:audit` resolves to `pnpm audit --audit-level high`, which exits non-zero on a `high` or `critical` advisory and exits zero otherwise.

### 6.2 Definition of a blocking finding

`docs/09_SECURITY_PRD.md` section 26 requires that a pull request produce *"No new critical dependency finding"* but does not define the term. It is defined here:

A **critical dependency finding** is an advisory that the scanner reports at severity `critical` against a package present in `pnpm-lock.yaml`, or an advisory at severity `high` whose vulnerable code path is reachable from a published `@nusajs/*` package at runtime.

**New** means the advisory is absent from the scanner output of the merge base. An advisory already present on the target branch is not new; it is tracked under section 6.3 and does not silently block unrelated work.

Reachability narrows the `high` tier only. It does not narrow the `critical` tier. A `critical` advisory blocks even when the vulnerable feature is never invoked, because unreachability is an argument about today's code that the next commit can invalidate, and `AGENTS.md` forbids a silent fallback from a secure behavior to an insecure one. Section 12 records the first application of this rule.

Development-only advisories are in scope. A development dependency executes on maintainer machines and in CI with repository credentials in reach, which is the `SEC-SUPPLY-003` and `SEC-SECRET-005` attack surface, so the `dev: true` marker in scanner output changes the remediation path, not the blocking decision.

### 6.3 Failure action

On a blocking finding the pull request does not merge. The author takes the first available option, in order:

1. Upgrade to a patched version within the same major range and refresh `pnpm-lock.yaml`.
2. Upgrade across a major version, with the section 4 review repeated for the new transitive set.
3. Replace or remove the dependency.
4. Record an accepted risk under `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 6, with the approval authority that section 6.3 of that document requires. A `critical` finding in a published package is a `P0` matter and therefore needs a named human maintainer; an agent may only propose it.

Suppressing an advisory, lowering `--audit-level`, or passing `--no-optional` to make the gate pass is prohibited. Internal remediation targets follow the severity rubric in `docs/09_SECURITY_PRD.md` section 24. They are targets, not published guarantees.

### 6.4 Secret scanning, stated honestly

`SEC-SUPPLY-002` requires secret scanning and `docs/09_SECURITY_PRD.md` section 26 requires no secret-scanning finding on every pull request. No secret scanner runs in this repository today. The canary-secret infrastructure and the client-bundle, manifest, and log scans are owned by FW-120, which depends on FW-107 and FW-114 and cannot be pulled forward.

This document therefore specifies the gate and does not claim it: the interim position is that the repository owner enables the hosting provider's secret scanning with push protection at the moment version control is initialized, which is a configuration action, not code, and that FW-120 supplies the framework-specific scans. Until then the requirement remains covered by `AR-001`, whose renewal in this task names the gap. Per `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.1, a gate that has never executed is a plan and not evidence, and nothing here changes that.

## 7. Lockfile and version pinning

- Every direct dependency is pinned to an exact version. Ranges are not used, including for development dependencies. `tests/workspace-skeleton.test.ts` enforces this.
- `pnpm-lock.yaml` is committed and is the single resolution source. CI installs with `--frozen-lockfile`, so a lockfile that disagrees with a manifest fails the install rather than resolving something new.
- The package manager itself is pinned through `packageManager` in `package.json` and provisioned by Corepack in CI, so the resolver that produced the lockfile is the resolver that consumes it.
- A dependency upgrade is a reviewable change: manifest and lockfile move in the same commit, and the section 4 license and transitive reviews apply whenever the transitive set changes.
- Automated upgrade tooling, when introduced, may open pull requests but may not merge them, because merging without the section 4 review would bypass this policy.

## 8. Provenance and publishing

Nothing is publishable today. Every manifest in the workspace sets `private: true`, and `tests/workspace-skeleton.test.ts` asserts it. The rules below bind the first publish rather than describing a process in use.

- Publishing happens only from the controlled CI workflow, triggered by a tag on a reviewed commit. A publish from a workstation is prohibited, and the npm access token used by CI is the only credential with publish rights.
- The publish job runs in a protected environment with required reviewers. Its permissions are `contents: read` and `id-token: write` and nothing else; the token is scoped to the `@nusajs` organization, and `pnpm publish --provenance` supplies the registry-supported provenance attestation through OIDC, so no long-lived publishing secret is stored.
- Every other job in the workflow keeps `contents: read`, so the least-privilege boundary is visible in the workflow file rather than in an external configuration.
- The publish job runs after the full gate set, not in parallel with it. A release channel from `docs/12_ROADMAP_AND_RELEASES.md` is selected explicitly per tag: `canary`, `next`, or `latest`.
- Package contents are constrained by an explicit `files` allow list in each publishable manifest, so a stray artifact is not published by default. The package-content review in section 8.1 verifies the result rather than trusting the pattern.

### 8.1 Publish dry run — reproducible manual gate

Required by `SEC-SUPPLY-003` and by the release-candidate gate in `docs/09_SECURITY_PRD.md` section 26. Recorded in the form `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.1 requires of a manual gate.

- **Executing role:** release manager, who must not be the author of the release commit.
- **Steps:** (1) check out the release tag in a clean tree; (2) `pnpm install --frozen-lockfile`; (3) `pnpm run verify`; (4) `pnpm run deps:audit` and `pnpm run deps:licenses`; (5) `pnpm publish --dry-run --provenance --access public -r` and capture the file list of every package; (6) compare each file list against the manifest's `files` allow list; (7) confirm no source map, environment file, test fixture, internal document, or credential appears; (8) confirm the provenance attestation is generated and names the expected workflow, repository, and commit.
- **Expected observation:** the dry run exits zero, every published file is intended, and the attestation identifies the controlled workflow.
- **Artifact:** the captured command transcript, stored with the release-candidate evidence index of `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 7.3.
- **Failure action:** the release stops. A publish is never retried with `--force` or with provenance disabled.

## 9. The release-artifact trust boundary

FW-008 recorded finding F-2: `docs/09_SECURITY_PRD.md` section 6 has no row for the boundary between a published artifact and the application that installs it, although `SEC-SUPPLY-002` and `SEC-SUPPLY-003` state its controls. This task owns that finding and records the row:

| Boundary | Untrusted side | Trusted side | Required controls |
|---|---|---|---|
| Release artifact to consuming application | published package contents and their transitive dependencies | the installing application's build, runtime, and developer machine | provenance attestation, package-content review, lockfile integrity, no install scripts, license disclosure |

The asymmetry matters and is the reason the row belongs in section 6. From the consumer's position, our published tarball is untrusted input: it executes in their build, its install scripts would execute with their credentials, and its transitive set becomes theirs. The controls are exactly the ones a consumer can verify without trusting us — an attestation they can check, a file list they can inspect, a lockfile they can pin, and the absence of any install script.

The row is added to `docs/09_SECURITY_PRD.md` section 6 by this task and appended to `docs/SECURITY_THREAT_MODEL_APPROVAL.md` as amendment A-2, which marks F-2 resolved. No requirement, priority, or evidence type is weakened, and no row is removed.

## 10. Gate bindings

| Gate tier | Condition | Mechanism | Status |
|---|---|---|---|
| Every pull request | lockfile integrity | `pnpm install --frozen-lockfile` in CI | specified; never executed, `AR-001` |
| Every pull request | no new critical dependency finding, as defined in section 6.2 | `pnpm run deps:audit` in CI | specified; never executed, `AR-001` |
| Every pull request | every license is allowed under section 5 | `pnpm run deps:licenses` in CI | specified; never executed, `AR-001` |
| Every pull request | new dependencies reviewed with install-script approval | recorded `Dependency review` per section 4 | manual gate, active immediately |
| Every pull request | no secret-scanning finding | FW-120, plus provider-side scanning at initialization | not enforced; section 6.4 |
| Every prerelease | production bundle and manifest secret scans | FW-120 | not enforced; section 6.4 |
| v1 release candidate | release provenance and package-content verification pass | section 8.1 manual gate | specified; unexercised |

This satisfies pull-request gate 8 of `docs/11_TESTING_AND_QUALITY.md` for its dependency and license halves and specifies its secret half without claiming it. `docs/09_SECURITY_PRD.md` acceptance criterion `AC-SEC-09` — *"Dependency and publishing workflows provide the approved provenance and policy evidence"* — is discharged as to the policy and the workflow definition. The evidence those workflows produce begins to exist when version control is initialized.

## 11. Enforcement

`tests/supply-chain-policy.test.ts` asserts the mechanical parts of this document:

- Every `SEC-SUPPLY-*` requirement declared by the security PRD is addressed by a section of this document or explicitly assigned to another task in section 2.
- All five review dimensions required by `SEC-SUPPLY-005` appear in the section 4 table.
- The license allow list is non-empty, and every license declared by the installed dependency tree at the time of writing is allowed or carries a recorded exception.
- A critical dependency finding is defined, and the definition states both the severity tier and what "new" means.
- The scanner commands named in section 6.1 exist as scripts in `package.json` and are invoked by `.github/workflows/ci.yml`.
- The publish dry run states an executing role, steps, an expected observation, and an artifact.
- The release-artifact boundary row exists in this document, in `docs/09_SECURITY_PRD.md` section 6, and as amendment A-2 in the approval record, and finding F-2 is marked resolved.
- Every `FW-` identifier referenced by this document exists in `CHECKLIST.md`.
- No install script is granted in `pnpm-workspace.yaml` without a corresponding approval record.

`scripts/check-licenses.mjs` enforces section 5 against the installed tree by parsing the allow list out of this document.

What cannot be automated, and is therefore a named manual gate:

| Judgement | Executing role |
|---|---|
| Whether a dependency's maintenance and ownership are adequate | pull-request approver, not the author |
| Whether a transitive cost is proportionate to the value | pull-request approver, not the author |
| Whether an install-script approval is justified | named maintainer |
| Whether a `high` advisory is reachable from published runtime code | pull-request approver, recorded in the review |
| Whether published package contents are correct | release manager, section 8.1 |
| Whether a license exception is acceptable | named maintainer |

## 12. First execution of section 6.2

The policy was applied to the repository as it stood when this document was written, and it failed immediately. `pnpm audit --json` reported advisory 1139528 at severity `critical` against `vitest@3.2.4`, *"When Vitest UI server is listening, arbitrary file can be read and executed"*, vulnerable below `3.2.6`, patched from `3.2.6`, marked `dev: true`.

The finding was blocking under section 6.2 even though this repository never starts the Vitest UI, which is exactly the reachability argument that section 6.2 refuses for the `critical` tier. Remediation took option 1: `vitest` moved from `3.2.4` to `3.2.7`, the exact pin was preserved, and `pnpm-lock.yaml` was refreshed. No ADR was needed, because ADR-005 chose Vitest as the test runner and a patch-level move inside the same minor does not revisit that choice.

Before: `pnpm audit --json` exit 1, `{"info":0,"low":0,"moderate":0,"high":0,"critical":1}`. After: exit 0, `{"info":0,"low":0,"moderate":0,"high":0,"critical":0}`, zero advisories, and `pnpm audit --prod --audit-level low` also clean.

The scanner found a real critical advisory on the first run against a four-package dependency tree. That is the argument for gate 8 being automated rather than periodic.

## 13. Residual risk accepted at M0

- No gate in section 10 has ever executed, because version control is not initialized. `AR-001` is renewed by this task rather than retired, and its renewal names this document as the specification whose execution is still missing.
- Secret scanning is specified and not enforced. This is the largest gap in `SEC-SUPPLY-002` and it belongs to FW-120.
- The license checker reads the declared license field. A package that declares a license it does not honor is out of reach of any mechanical check, and the ownership review in section 4 is the only defense.
- `pnpm audit` depends on the registry's advisory database. Absence of a finding is absence of a published advisory, not evidence of safety, and `docs/09_SECURITY_PRD.md` section 28 already says no scanner can mark the framework secure.
- The merge-base comparison in section 6.2 cannot be implemented until version control exists, so the current gate blocks on any `critical` advisory rather than only on a new one. This is stricter than the requirement and is left in place.
- Nothing is published, so provenance, protected environments, and the publish dry run are unexercised specifications. `SEC-SUPPLY-003` remains covered by `AR-001` until a release exists.
- The spike workspace carries six development dependencies with a wider transitive set than the root. It is `private`, is excluded from the framework graph by `tests/workspace-skeleton.test.ts`, and is scanned by the same audit, but it was admitted before this policy existed and was not subjected to the section 4 review.
