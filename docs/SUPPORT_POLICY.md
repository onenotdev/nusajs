# Toolchain and Support Policy

Owner: FW-005. Governing decision: [docs/adr/ADR-006-supported-runtime-and-typescript-policy.md](adr/ADR-006-supported-runtime-and-typescript-policy.md) (`Accepted`).

This document is the single normative source for which runtimes, TypeScript versions, package managers, and operating systems `[FRAMEWORK_NAME]` supports, and for what "supported" obliges the project to do. `docs/11_TESTING_AND_QUALITY.md` names a platform matrix in four lines; this document is the matrix those lines refer to.

It defines policy only. It implements nothing, and it does not discharge any `SEC-*` requirement.

Enforced by `tests/support-policy.test.ts`. Where a rule is mechanical, that test asserts it against `package.json`, `tsconfig.base.json`, and `.github/workflows/ci.yml`, so the policy and the toolchain cannot drift apart silently.

## 1. What "supported" means

A platform is supported when all four of the following hold. Anything weaker is a lower tier or is unsupported, and may not be described as supported in documentation, release notes, or marketing.

1. **Gated.** A pull request that breaks it fails a required gate. A platform tested only informally is not supported.
2. **Conformant.** The conformance suite for that platform's capability set passes, per `AC-ADAPT-01` and `AC-PROD-03`.
3. **Bounded.** Its support window has a stated end, expressed as a date or as an upstream lifecycle event, never as "indefinitely".
4. **Truthful about limits.** Capabilities the platform cannot provide are declared `unsupported` or `emulated` rather than silently degraded, per `docs/02_ARCHITECTURE.md`.

Two consequences follow that this policy states explicitly, because both are easy to violate by omission:

- Adding a platform to a CI matrix does not make it supported. Tier assignment in section 3 does.
- Removing a platform from a CI matrix does not make it unsupported. It makes the project's claim false until section 3 is amended.

## 2. As-of date and the review rule

This policy is stated **as of 2026-08-17**. Every upstream lifecycle date below is taken from the Node.js release schedule and from the TypeScript release history on that date.

Upstream lifecycle dates move. The policy is therefore reviewed at each milestone boundary (`M0` through `M7`) and at each Node LTS transition, whichever comes first. A review that finds a supported line has passed its upstream end-of-life must either drop the line in the same change or record an accepted risk under `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 6, because shipping against an end-of-life runtime means shipping against a runtime that no longer receives security patches.

## 3. Runtime support tiers

Three tiers, ordered. The tier list is closed: a runtime not named here is unsupported.

| Tier | Runtimes | Obligation | Release effect |
|---|---|---|---|
| 1 — Gating | Node.js, static output | Full conformance suite on every supported version and every supported OS, on every pull request | A tier-1 failure blocks the merge and blocks the release |
| 2 — Declared | Web-Standard edge runtimes reached through an adapter | Conformance for the capabilities the adapter declares `supported`; declared limits for CPU, memory, subrequests, body size, and streaming | A tier-2 failure blocks that adapter's release, not the core release |
| 3 — Deferred | Bun, Deno | None until tier 1 conformance is stable | No release effect; may not be advertised as supported |

Tier 1 is the baseline the universal packages are written against. Tier 3 is deferred by `docs/07_ADAPTERS_AND_PLUGINS.md`: "Introduced only after Node conformance is stable. Universal packages do not change to accommodate them." That sentence is a constraint on this policy, not a preference — a tier-3 runtime may not motivate a change to a universal package, so promoting one is a decision about the adapter layer and never about core.

Tier 2 exists because an edge runtime is reached only through an adapter, and an adapter declares its capability map. Its correctness claim is therefore scoped to what it declared, which is why a tier-2 failure cannot block the core release while a tier-1 failure must.

### 3.1 Node.js supported lines

Only Node lines inside their official support window are supported. Current and maintenance LTS both count; a line past its upstream end date does not.

| Line | Codename | Entered LTS | Maintenance | Upstream end | Status here |
|---|---|---|---|---|---|
| 20.x | Iron | 2023-10-24 | 2024-10-22 | 2026-04-30 | Unsupported — upstream end-of-life passed |
| 22.x | Jod | 2024-10-29 | 2025-10-21 | 2027-04-30 | Supported — floor |
| 24.x | Krypton | 2025-10-28 | 2026-10-20 | 2028-04-30 | Supported — primary |
| 26.x | — | 2026-10-28 | 2027-10-20 | 2029-04-30 | Not yet supported — not yet an LTS line |

**The floor is Node 22.12.0.** The major comes from the table: 22.x is the oldest line still inside its support window. The minor is not arbitrary and is not "the latest we happened to test" — 22.12.0 is the first 22.x release in which `require(esm)` is enabled without a flag, and a lower minor would make the ESM-only distribution decision in section 4 conditional on a flag the project does not control.

**The primary line is Node 24.x.** Primary means diagnostics, performance baselines, and reproducibility artifacts are generated there, so that two artifacts are comparable by default.

Odd-numbered Node lines are never supported. They reach end-of-life before any release line of this project could rely on them.

### 3.2 Dropping a Node line

A supported line is dropped when, and only when, its upstream support window ends. Dropping is a breaking change for consumers and is therefore:

- allowed in a major release without further justification;
- allowed in a minor release **only** when the line is past its upstream end date, because continuing to claim support for an unpatched runtime is a security misstatement and is worse than the compatibility break;
- never allowed in a patch release.

Dropping a line requires, in the same change: the section 3.1 table updated, `engines.node` raised, the CI matrix reduced, and a release note entry. The enforcing test fails if the table and `engines.node` disagree, so three of those four cannot be forgotten.

Raising the floor for convenience — to use a newer API without an upstream end-of-life — is a decision requiring a superseding ADR, not a policy application.

## 4. TypeScript and language policy

- **Distribution is ESM only.** There is no CommonJS build. This is `NFR-010`, and it is why the Node floor is tied to unflagged `require(esm)`: a consumer on CommonJS must be able to reach the package through the runtime rather than through a bundler workaround.
- **Strict mode is not configurable.** `NFR-002` and `AGENTS.md` require it. The option set in `tsconfig.base.json` is the floor, not a suggestion, and packages may add strictness but may not remove any of it.
- **Types are public API.** A type-level breaking change is a breaking change under section 6. A type that is wide enough to accept invalid input is a defect even when the runtime rejects that input, and a type that narrows without a major release is a break even when no runtime behavior changed.
- **Types never imply validation.** A compile-time type is not a runtime check. This restates `SEC-INPUT-001` and commitment C3 of `docs/adr/ADR-004-route-module-api-syntax.md`, and it is in this document because a support policy that promised type safety without saying this would be read as a security claim.

### 4.1 Supported TypeScript range

**The floor is TypeScript 5.8. The development version is 5.9.3.**

The floor is derived from the repository rather than chosen: `tsconfig.base.json` sets `erasableSyntaxOnly`, which does not exist before TypeScript 5.8, and `isolatedDeclarations`, which does not exist before 5.5. A consumer below the floor cannot type-check against the shipped declarations at all, so the floor is a fact about the emitted artifacts, not a preference.

The supported range is the floor through the latest stable release. Two rules bound it:

- The floor rises only when a compiler option or syntax the project actually needs requires it, and the need is stated in the release note. "Newer is better" is not a reason.
- The latest stable release is tested on every pull request. Pre-release compilers — `beta`, `rc`, and `next` — are tested informationally, and an informational failure does not block a merge. This is the "documented supported range plus informational canary testing" line of `docs/11_TESTING_AND_QUALITY.md`, made specific: canary results are advance warning, never a gate.

`skipLibCheck` is enabled in `tsconfig.base.json` for this repository's own builds. It may not be relied on by the published packages' correctness claim: the public type surface is checked by the API report gate owned by FW-701, not by a consumer's `skipLibCheck` setting.

## 5. Toolchain and development environment

`docs/adr/ADR-005-monorepo-and-toolchain.md` chose the tools. This section states what supporting them obliges, and adds nothing that ADR-005 did not decide.

| Tool | Version | Support obligation |
|---|---|---|
| pnpm | Pinned by `packageManager` | Primary. Every documented command is a pnpm command. A pull request that breaks a pnpm workflow fails. |
| npm | Current stable | Compatibility only: installing and building a generated project must work. Workspace development is not supported on npm. |
| Yarn | Current stable, modern releases only | Smoke level: installation of a generated project is checked. Nothing else is claimed. |
| Biome | Pinned exactly | Formatting and lint. A version bump is a pull request of its own, because a formatter bump rewrites files and would otherwise hide a real diff. |
| Vitest | Pinned exactly | Test runner. |
| TypeScript | Pinned exactly, floor per section 4.1 | Type checking. |

Package-manager tiers exist because the alternative is a false claim in both directions: saying only pnpm works discourages consumers who never touch this workspace, and saying all three are supported obliges a workspace matrix the project does not run.

Development operating systems: current supported Ubuntu, Windows, and macOS, all three gating. Windows is gating rather than best-effort because path handling, case sensitivity, and reserved device names differ there in ways that reach routing directly — `docs/adr/ADR-003-route-filesystem-convention.md` amendments A2 and A3 exist because of measurements taken on Windows.

## 6. Versioning, deprecation, and end of support

- **Semantic versioning** applies to every stable package. The public API surface under it includes runtime behavior, emitted types, diagnostic codes, and manifest schema versions.
- **Pre-v1**, the `0.x` line makes no compatibility promise between minors. Breaking changes are documented in release notes with migration steps but do not require a major.
- **After v1**, a deprecation remains for at least one appropriate minor cycle before removal, unless a security fix requires faster removal. A deprecation carries a warning, documentation, and a codemod where practical.
- **Release channels** are `canary` for qualifying main-branch builds, `next` for milestone previews, and `latest` for stable releases only. Support obligations in this document attach to `latest`. A `canary` or `next` build carries no support claim and no compatibility claim.

### 6.1 End-of-support lines

`docs/09_SECURITY_PRD.md` section 24 requires the public repository to publish supported release lines and end-of-support dates, and immediately constrains how: "Do not publish target windows as guarantees until the maintainer team can sustain them."

This policy therefore separates the shape from the promise.

| Line | Receives | Target window | Published as a guarantee? |
|---|---|---|---|
| Current major | Features, fixes, security fixes | While current | Yes, once v1 ships |
| Previous major | Security fixes only | 6 months after the successor's stable release | No — internal target until the maintainer team demonstrates it |
| Older majors | Nothing | — | Not applicable |
| `0.x` | Fixes on the newest minor only | None | No |

The "previous major" row is deliberately an internal target and not a guarantee. Publishing it before the maintainer team has sustained one backport cycle would convert an aspiration into a commitment consumers plan around, which is exactly what section 24's closing sentence forbids. FW-709 owns `SECURITY.md` and owns the decision to publish these windows; this policy owns their shape. A window may be promoted from target to guarantee only after one backport cycle has actually been executed.

## 7. Security analysis

No control is implemented and, per `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.2, **no `SEC-*` requirement is discharged by this document.**

What the policy does affect:

- `SEC-SUPPLY-002` and `SEC-SUPPLY-003` (`P0`): the supported-version set determines what "controlled CI from reviewed commits" must cover. A matrix narrower than the claimed support set means an unscanned, unbuilt, still-advertised platform. Enforced mechanically: the test asserts the CI matrix contains every supported Node major.
- `SEC-SUPPLY-001` (`P0`): tier 3 must not be described as supported, because a runtime with no gate has no evidence. This is the same reasoning that forbids describing metadata permissions as a sandbox.
- Section 24 of the security PRD: end-of-support dates are required to exist and are required not to be overstated. Section 6.1 satisfies the first and respects the second.
- `docs/02_ARCHITECTURE.md` capability states: tier 2 obliges an adapter to declare `supported`, `emulated`, or `unsupported`, and section 1 rule 4 forbids silent degradation, consistent with `docs/STRICT_SECURITY_MODE.md` rule FC-10.

The abuse case this policy is written against is not an attacker sending a payload. It is a consumer deploying onto an end-of-life runtime while the project's own documentation tells them it is supported. That is why section 3.2 permits dropping an end-of-life line in a minor release: the compatibility break is the smaller harm.

## 8. What is not decided here

- **Browser support.** Reserved as ADR-012 and required by `docs/11_TESTING_AND_QUALITY.md` to be finalized before v1. Nothing in this document constrains it, and a client-runtime baseline may not be inferred from the Node floor.
- **The security-manifest schema and the strict-mode configuration surface.** Proposed in `docs/adr/ADR-008-security-manifest-and-strict-mode.md`, which is `Proposed` and therefore not accepted authority.
- **Adapter-by-adapter capability maps.** Owned by FW-113, FW-211, and FW-214. Tier 2 states the obligation, not the content.
- **The publish and provenance mechanics.** Owned by `docs/SUPPLY_CHAIN_POLICY.md` section 8.
- **Which Node APIs universal packages may use.** None: `NFR-001` forbids Node built-ins in universal packages, and the boundary scanner owned by FW-117 enforces it. The Node floor governs the adapter and tooling layers, and a floor is never a licence for a universal package to import a built-in.

## 9. Manual gates

These judgements are not mechanical and stay with a named role.

| Judgement | Executing role | Why it cannot be automated |
|---|---|---|
| Promoting Bun or Deno from tier 3 | Core maintainers | Requires the assessment that tier 1 conformance is "stable", which is a judgement about test coverage adequacy |
| Promoting an end-of-support window from target to guarantee | Core maintainers | Requires a capacity commitment |
| Accepting that a floor rise is necessary rather than convenient | Pull-request approver | Requires evaluating whether an alternative implementation exists |
| Deciding whether a type change is breaking | Pull-request approver, against the FW-701 API report | Requires distinguishing a narrowing fix from a narrowing break |

## 10. Residual risk

- Every upstream date in section 3.1 was correct on the as-of date and will age. The review rule in section 2 is a process control, not an automated one; nothing fails if a reviewer skips a milestone boundary.
- The npm and Yarn tiers are stated but not yet gated, because no generated project exists to install — FW-115 and FW-215 own the create-to-page path that would exercise them. Until then those two rows are claims about intent.
- Tier 2 has no adapter, so its obligation is unexercised.
- The tier-1 matrix and the informational TypeScript canary job are defined in `.github/workflows/ci.yml` but have never been observed executing from the development environment. A defined gate that has not run is not evidence, per `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.1, and `AR-001` covers the gap.
- The Node floor's justification rests on `require(esm)` behaviour in 22.12.0, which was taken from release documentation rather than by executing 22.12.0 on this machine. The local toolchain is Node v24.16.0.
- The TypeScript floor of 5.8 is derived from which release introduced `erasableSyntaxOnly`; nothing type-checks against 5.8.
- Section 6.1's previous-major window has never been executed, so the project has no evidence it can sustain any backport window at all.
