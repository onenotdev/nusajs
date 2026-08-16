# Threat Model and Security PRD Approval Record

Task: FW-008. Date: 2026-08-15. Approver: lead founding engineer (agent: GitHub Copilot, `gpt-pro`).
Subject documents: `docs/09_SECURITY_PRD.md` (normative), reviewed against `docs/02_ARCHITECTURE.md`, `docs/00_MASTER_PRD.md`, `docs/14_REQUIREMENTS_TRACEABILITY.md`, and `CHECKLIST.md`.

## 1. Decision

The threat model in `docs/09_SECURITY_PRD.md` sections 4, 5, 6, and 22, and the requirement set in sections 8 through 21, are **approved as the security baseline for M0**. All 63 `SEC-*` requirements are carried forward unchanged. No requirement was weakened, removed, or reclassified.

This record is the coverage baseline. It states, for every requirement, which checklist task owns it and what kind of evidence will discharge it. Section 6 records ten findings, each with an owner, so that the M0 exit criterion in `docs/12_ROADMAP_AND_RELEASES.md` — "no unowned P0 question" — is demonstrably satisfied rather than assumed.

No ADR accompanies this task. FW-008 introduces no public API and selects no architecture; it approves an existing normative document and produces a coverage map. The ADR trigger therefore does not fire. Findings that would change PRD text are recorded here for approval, not applied unilaterally.

### 1.1 What this approval does not mean

- It is **not** the "threat model reviewed by maintainers and an independent reviewer" gate from `docs/09_SECURITY_PRD.md` section 26. That gate is a v1 release-candidate requirement and cannot be satisfied by a single approver. Independent review remains outstanding and is owned by FW-703.
- It does **not** assert that any requirement is implemented. At the time of approval the repository contains no framework source code. Every entry in section 4 is a planned obligation, not evidence.
- It does **not** define the accepted-risk record format, the evidence index format, or the ongoing workflow for keeping them current. That is FW-009's scope and is deliberately left out of this record.
- It does **not** create a strict security mode or fail-closed policy. That is FW-018's scope.
- It does **not** constitute dependency, license, provenance, or publishing policy. That is FW-019's scope, which this record's `SEC-SUPPLY-*` rows depend on.

## 2. Threat model review against the architecture

`docs/02_ARCHITECTURE.md` defines eight layers. Each was checked for at least one governing trust boundary in section 6 of the Security PRD.

| Architecture layer | Governing boundaries (Security PRD section 6) | Result |
|---|---|---|
| Core | none directly; constrained by NFR-001 and the package dependency rules | covered by FW-117, no boundary needed |
| Compiler | plugin to build; filesystem to route/assets; environment to client graph | covered |
| Router | browser to server | covered |
| Server runtime | browser to server; server to browser; app to cache; logs/traces to sink | covered |
| Client runtime | server to browser; dev browser to dev server | covered |
| Renderer | server to browser | partially covered — see F-1 |
| Adapter | adapter to host | covered, but see F-3 for the static case |
| Tooling | dev browser to dev server; filesystem to route/assets | covered |

Protected assets (section 4, eleven entries) each map to at least one requirement family: source code and build integrity to `SEC-SUPPLY-*`; secrets and credentials to `SEC-SECRET-*`; tokens, cookies, sessions, and CSRF tokens to `SEC-REQ-*` and `SEC-AUTH-*`; personal and business data to `SEC-OBS-*` and `SEC-CACHE-*`; server memory and request-local state to `SEC-AUTH-002` and `SEC-XSS-004`; cache entries and invalidation channels to `SEC-CACHE-*`; manifests and source maps to `SEC-SECRET-002` and `SEC-SECRET-004`; developer workstations and dev-server access to `SEC-DEV-*`; supply chain to `SEC-SUPPLY-*`; availability to `SEC-DOS-*`; route and response integrity to `SEC-INPUT-*` and `SEC-REQ-*`.

Threat actors (section 5, nine entries) each map to at least one family: unauthenticated remote attacker and header/URL/body/upload-controlling attacker to `SEC-INPUT-*`, `SEC-FILE-*`, and `SEC-XSS-*`; authenticated malicious user to `SEC-AUTH-*` and `SEC-CACHE-*`; cross-site attacker to `SEC-REQ-*` and `SEC-XSS-*`; compromised dependency, plugin, adapter, or build script to `SEC-SUPPLY-*`; misconfigured developer or operator to `SEC-DEV-*`, `SEC-HEADER-*`, and objective SO-04; local-network attacker against an exposed dev server to `SEC-DEV-001` and `SEC-DEV-003`; insider or CI actor with excessive secret access to `SEC-SUPPLY-003` and `SEC-SECRET-005`; automated resource-exhaustion attacker to `SEC-DOS-*`.

Abuse cases (section 22, fourteen entries) map to owning tasks as follows. Thirteen have an owner; one does not, which is finding F-5.

| Abuse case | Owning task(s) |
|---|---|
| `</script>` and Unicode variants injected into loader data | FW-213 |
| encoded traversal paths through every official adapter | FW-118, FW-214 |
| malicious origin submits cookie-authenticated mutations | FW-504 |
| forged forwarded-host for password-reset or absolute-URL poisoning | FW-110, FW-207 |
| one user primes a public cache with another user's private content | FW-509 |
| a plugin writes outside the build directory or reads all env secrets | FW-602, FW-603 |
| a client imports a server-only module transitively | FW-212, FW-117 |
| a hostile website opens a network-exposed HMR socket | FW-121, FW-308 |
| a server function receives a deeply nested, oversized, or prototype-bearing payload | FW-122, FW-502, FW-503 |
| a remote fetch plugin follows a redirect into a private network | **none — see F-5** |
| a multipart upload uses traversal names, too many parts, or slow delivery | FW-122, FW-204 |
| an error cause contains a token and reaches a log sink | FW-217 |
| concurrent SSR requests reuse nonce, identity, locale, or loader state | FW-406, FW-109 |
| a rewrite loop or pathological route consumes unbounded CPU | FW-207, FW-106, FW-118 |

## 3. Requirement inventory

Counted from `docs/09_SECURITY_PRD.md` on 2026-08-15: **63 requirements, 38 `P0` and 25 `P1`, across 14 families**. No `P2` requirement is currently defined. Family sizes: INPUT 5, XSS 6, REQ 5, AUTH 4, CACHE 5, SECRET 5, DEV 6, SUPPLY 6, SSRF 3, FILE 4, DOS 4, CRYPTO 3, OBS 4, HEADER 3.

`tests/security-coverage.test.ts` enforces that these numbers and this record's coverage table stay in agreement with the PRD, so the record cannot silently drift when a requirement is added or renamed.

## 4. Coverage map

Evidence types are the three permitted by `docs/09_SECURITY_PRD.md` section 7: `automated test`, `reproducible manual gate`, and `accepted risk`. The first task listed is the primary owner. "Complete by" is the milestone of the last owning task; earlier partial evidence is expected where an earlier task is listed.

| Requirement | P | Owning tasks | Planned evidence | Complete by |
|---|---|---|---|---|
| SEC-INPUT-001 | P0 | FW-503, FW-203, FW-204, FW-205 | automated test: runtime-validation contract tests plus type tests asserting types are not treated as validation | M5 |
| SEC-INPUT-002 | P0 | FW-122, FW-214 | automated test: per-limit fixtures replayed through every official adapter | M2 |
| SEC-INPUT-003 | P0 | FW-118, FW-214 | automated test: malicious URL corpus and adapter normalization conformance | M2 |
| SEC-INPUT-004 | P0 | FW-119, FW-209 | automated test: traversal and symlink corpus after canonicalization | M2 |
| SEC-INPUT-005 | P1 | FW-106, FW-118 | automated test: property and fuzz tests plus explicit matcher complexity limits | M1 |
| SEC-XSS-001 | P0 | FW-112, FW-111 | automated test: context escaping units and renderer conformance; unsafe API requires an explicit name | M1 |
| SEC-XSS-002 | P0 | FW-213 | automated test: script-breakout and prototype-pollution corpora | M2 |
| SEC-XSS-003 | P0 | FW-112, FW-213, FW-207 | automated test: attribute, URL, style, and script-context corpus | M2 |
| SEC-XSS-004 | P0 | FW-406 | automated test: concurrent nonce isolation with no global mutable state | M4 |
| SEC-XSS-005 | P1 | FW-405, FW-408, FW-213 | automated test: opaque IDs, duplicate IDs, dangerous prototypes, unsupported values | M4 |
| SEC-XSS-006 | P1 | FW-307 | automated test: production diagnostic snapshots contain no unescaped content | M3 |
| SEC-REQ-001 | P0 | FW-504 | automated test: browser same-site and cross-site suite, missing/invalid/reused token | M5 |
| SEC-REQ-002 | P0 | FW-504, FW-205 | automated test: content-type and cross-origin rejection fixtures | M5 |
| SEC-REQ-003 | P0 | FW-207 | automated test: redirect fuzzing, allowlist and unsafe-override behavior | M2 |
| SEC-REQ-004 | P0 | FW-110, FW-207 | automated test: hostile Host, Origin, Referer, and forwarded-header fixtures with proxy spoofing | M2 |
| SEC-REQ-005 | P1 | FW-501, FW-502 | automated test plus the FW-501 transport ADR recording non-retry semantics | M5 |
| SEC-AUTH-001 | P0 | FW-206 | automated test: authorization-denial fixtures separating identity from access | M2 |
| SEC-AUTH-002 | P0 | FW-109, FW-110 | automated test: concurrent identity isolation and request-context reuse rejection | M1 |
| SEC-AUTH-003 | P1 | FW-218 | automated test: cookie helper defaults asserting `HttpOnly`, `Secure`, and an explicit `SameSite`, with prefix and scope fixtures — owner created by the FW-009 amendment resolving F-6 | M2 |
| SEC-AUTH-004 | P1 | conditional — see F-7 | conditional: activates with the first official session integration; registered in `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 5 | conditional; see F-7 |
| SEC-CACHE-001 | P0 | FW-506, FW-505 | automated test: private-dependency detection with build and runtime warning | M5 |
| SEC-CACHE-002 | P0 | FW-506, FW-507 | automated test: deterministic key tests plus canary scanning of keys and logs | M5 |
| SEC-CACHE-003 | P0 | FW-508, FW-505 | automated test: namespace collision and cross-environment invalidation attempts | M5 |
| SEC-CACHE-004 | P0 | FW-506, FW-124 | automated test: cache-poisoning corpus over `Vary`, `Cache-Control`, surrogate, and host values | M5 |
| SEC-CACHE-005 | P1 | FW-507, FW-509 | automated test: stampede, stale fallback, failed regeneration, clock skew | M5 |
| SEC-SECRET-001 | P0 | FW-212, FW-117 | automated test: static client/server boundary scan causing build failure with a value-free diagnostic | M2 |
| SEC-SECRET-002 | P0 | FW-212, FW-107 | automated test: public-env schema validation and `security-manifest.json` visibility | M2 |
| SEC-SECRET-003 | P0 | FW-217, FW-120 | automated test: canary secrets across errors, logs, traces, manifests, and source maps | M2 |
| SEC-SECRET-004 | P1 | FW-114, FW-705 | automated test on public asset output plus a reproducible manual gate on deployment guidance — weak owner, see F-8 | M7 |
| SEC-SECRET-005 | P1 | FW-115 | automated test: child-process environment assertion — weak owner, see F-8 | M1 |
| SEC-DEV-001 | P0 | FW-121 | automated test: loopback default, explicit exposure flag, warning content | M1 |
| SEC-DEV-002 | P0 | FW-119, FW-121 | automated test: traversal and symlink corpus against source viewing and stack-frame resolution | M1 |
| SEC-DEV-003 | P0 | FW-121, FW-308 | automated test: unauthenticated and cross-origin HMR, inspector, and RPC attempts | M3 |
| SEC-DEV-004 | P0 | FW-121, FW-307 | automated test: overlay and dev-API redaction snapshots | M3 |
| SEC-DEV-005 | P1 | FW-121 | automated test: payload, connection, and message-rate limits | M1 |
| SEC-DEV-006 | P1 | FW-407, FW-114 | automated test: production manifest and bundle inspection for dev-only code and routes | M4 |
| SEC-SUPPLY-001 | P0 | FW-601, FW-609 | reproducible manual gate: documentation review asserting plugins are trusted code and no sandbox is claimed | M6 |
| SEC-SUPPLY-002 | P0 | FW-019 | automated test: CI dependency, secret, and license scanning plus registry-supported provenance, specified by `docs/SUPPLY_CHAIN_POLICY.md` sections 6 to 8; dependency and license scanning are wired into CI, secret scanning is owned by FW-120, and no gate has executed, so the requirement stays recorded as `AR-001` | M0 |
| SEC-SUPPLY-003 | P0 | FW-019, FW-707 | reproducible manual gate: publish dry run from controlled CI with least-privilege protected environments, specified by `docs/SUPPLY_CHAIN_POLICY.md` section 8.1; currently unexercised and recorded as `AR-001` | M7 |
| SEC-SUPPLY-004 | P1 | FW-602, FW-603 | automated test: plugin declaration conformance | M6 |
| SEC-SUPPLY-005 | P1 | FW-019 | reproducible manual gate: recorded dependency review with install-script approval, specified by `docs/SUPPLY_CHAIN_POLICY.md` sections 4 and 4.1 | M0 |
| SEC-SUPPLY-006 | P1 | FW-602 | automated test: malicious output-path fixture confined to declared roots | M6 |
| SEC-SSRF-001 | P0 | no implementing task — gate owner FW-701, see F-5 | reproducible manual gate: the public API audit confirms core ships no outbound-fetch helper; introducing one requires an accepted ADR and converts this row to an automated test | M7 |
| SEC-SSRF-002 | P1 | conditional — FW-603, see F-5 | conditional: applies when an official fetching plugin is proposed | conditional |
| SEC-SSRF-003 | P1 | conditional — FW-603, see F-5 | conditional: applies when an official fetching plugin is proposed | conditional |
| SEC-FILE-001 | P0 | FW-122, FW-204 | automated test: traversal filenames, Unicode separators, reserved platform names | M2 |
| SEC-FILE-002 | P0 | FW-122 | automated test: oversized multipart, part count, slow upload, abort cleanup | M2 |
| SEC-FILE-003 | P0 | FW-209, FW-119 | automated test: MIME confusion, sniffing, traversal, and non-execution of user files | M2 |
| SEC-FILE-004 | P1 | conditional — FW-603, see F-11 | conditional: applies when archive, image, or media plugins are proposed | conditional |
| SEC-DOS-001 | P0 | FW-122, FW-402 | automated test: abort and deadline propagation through every stage including cache and adapter | M4 |
| SEC-DOS-002 | P0 | FW-122, FW-213 | automated test: depth and size limits on parsers, matchers, rewrite chains, error causes | M2 |
| SEC-DOS-003 | P1 | FW-206 | automated test: rate-limiting hook contract with no embedded storage vendor — see F-9 | M2 |
| SEC-DOS-004 | P1 | FW-113, FW-122 | automated test: graceful shutdown under load with bounded in-flight completion | M2 |
| SEC-CRYPTO-001 | P0 | FW-123, FW-701 | reproducible manual gate: static review, plus an automated test denying custom primitive implementations | M1 |
| SEC-CRYPTO-002 | P0 | FW-123 | automated test: randomness source and entropy assertions with deterministic test paths separated | M1 |
| SEC-CRYPTO-003 | P1 | FW-123, FW-705 | reproducible manual gate: documented algorithms, key sizes, rotation, and timing-safe comparison | M7 |
| SEC-OBS-001 | P0 | FW-217, FW-510 | automated test: allowlist-by-default assertions over headers, cookies, queries, bodies, keys, env | M2 |
| SEC-OBS-002 | P0 | FW-217, FW-510 | automated test: recursive error-cause sanitization before any user or vendor sink | M2 |
| SEC-OBS-003 | P1 | FW-510 | reproducible manual gate: metric cardinality review with bounded-label assertions | M5 |
| SEC-OBS-004 | P1 | FW-607 | automated test: opt-in default, no-network default, inspectable payload | M6 |
| SEC-HEADER-001 | P1 | FW-124 | automated test: composable helper units and strict starter fixtures | M1 |
| SEC-HEADER-002 | P1 | FW-124 | automated test: deterministic merge with conflict diagnostics and no silent weakening | M1 |
| SEC-HEADER-003 | P1 | FW-124, FW-408, FW-214 | automated test: normal, redirected, error, streamed, and static response parity | M4 |

Result at approval (2026-08-15): 38 of 38 `P0` requirements have an owner. Thirty-seven have an implementing task; `SEC-SSRF-001` has a gate owner and an ADR precondition instead, because core deliberately ships no outbound-fetch helper. Of 25 `P1` requirements, 21 have an implementing task, three are conditional on integrations that do not yet exist, and one (`SEC-AUTH-003`) is unowned and recorded as F-6.

Result after amendment A-1 (2026-08-16): 38 of 38 `P0` requirements have an owner, unchanged. Of 25 `P1` requirements, 21 have an implementing task and four are conditional on integrations that do not yet exist. No `P1` requirement is unowned, because FW-009 created FW-218 to own `SEC-AUTH-003` and moved `SEC-AUTH-004` into the conditional registry alongside `SEC-SSRF-002`, `SEC-SSRF-003`, and `SEC-FILE-004`.

## 5. Approval against milestone gates

`docs/09_SECURITY_PRD.md` section 26 defines four gate tiers. Their status at the time of approval:

- **Every pull request** — not yet enforceable. `.github/workflows/ci.yml` runs formatting, lint, type checking, and tests, but there are no security tests, no dependency finding gate, no secret scanning, and no boundary scan. Owners: FW-019 (dependency and secret scanning), FW-117 (boundary scan), FW-009 (which gate output counts as evidence). This is expected at M0 and is not a gap in the threat model.
- **Every prerelease** — not yet applicable; no prerelease exists.
- **v1 release candidate** — not satisfiable now. The independent-review clause is owned by FW-703 and is explicitly outside this approval, per section 1.1.
- **Stable release blocker policy** — accepted as written. No amendment proposed.

## 6. Findings

Each finding has an owner, so none is an unowned question. Findings F-1 through F-3 and F-10 would change PRD or checklist text; they are recorded for approval and are not applied by this task.

| ID | Finding | Severity | Disposition and owner |
|---|---|---|---|
| F-1 | Section 6 has no row for the renderer implementation as an untrusted dependency executing inside the server runtime. ADR-002 already commits that framework-generated markup must not rely on renderer escaping alone, which implies the boundary exists. | low | The renderer contract must document it as a specialization of the dependency supply chain. Owner: FW-111. |
| F-2 | Section 6 has no row for release artifact to consuming application, although `SEC-SUPPLY-002` and `SEC-SUPPLY-003` state the controls. | low | Record the boundary when publishing policy is written. Owner: FW-019. **Resolved by amendment A-2: the boundary row is now in `docs/09_SECURITY_PRD.md` section 6 and in `docs/SUPPLY_CHAIN_POLICY.md` section 9.** |
| F-3 | Section 6's adapter-to-host row does not distinguish static output served by a third-party host, where header and MIME behavior are outside framework control. `SEC-HEADER-003` and `SEC-FILE-003` cover the requirement. | low | Document host-dependent limits in the static adapter. Owner: FW-211. |
| F-4 | The security-traceability table in `docs/14_REQUIREMENTS_TRACEABILITY.md` maps whole families, so for eleven requirements the primary owner is absent from that table: SEC-INPUT-001 (FW-503), SEC-INPUT-005 (FW-106), SEC-XSS-001 and SEC-XSS-003 (FW-112), SEC-XSS-006 (FW-307), SEC-REQ-004 (FW-110), SEC-AUTH-002 (FW-109), SEC-SECRET-003 and SEC-OBS-001 and SEC-OBS-002 (FW-217), SEC-DEV-006 (FW-407). | medium | This record is the requirement-level map and is now linked from `docs/14` as the FR-013 and AC-SEC-01–10 evidence artifact. Family rows stay as summaries. Owner: this record; workflow for keeping it current is FW-009. |
| F-5 | The `SEC-SSRF-*` family has no implementing task, and abuse case 10 ("a remote fetch plugin follows a redirect into a private network") is the only one of the fourteen required abuse cases without an owning task. | medium | `SEC-SSRF-001` is discharged by a gate: core ships no outbound-fetch helper, verified by the public API audit, and introducing one requires an accepted ADR. `SEC-SSRF-002`, `SEC-SSRF-003`, and abuse case 10 activate when an official fetching plugin is proposed, and must then be covered by the plugin conformance kit. Owners: FW-701 (gate), FW-603 (conformance). |
| F-6 | `SEC-AUTH-003` (cookie helper defaults) has no owning task. No checklist task covers cookie helpers. | medium | Unowned `P1`. Requires a checklist amendment creating a cookie-primitives task before M2 closes, or an accepted-risk record. Owner of the decision: FW-009. **Resolved by amendment A-1: FW-218 created and now owns the requirement.** |
| F-7 | `SEC-AUTH-004` (session rotation, logout invalidation, expiry, replay) is scoped to "official session integrations", none of which are planned in M0 through M7. | low | Conditional. Activates with the first official session integration. Owner: FW-009 to record it as conditional rather than pending. **Resolved by amendment A-1: entered in the conditional registry.** |
| F-8 | `SEC-SECRET-004` (source-map publication) and `SEC-SECRET-005` (child-process environment minimization) have weak owners: neither FW-114 nor FW-115 mentions these behaviors. | low | Both tasks must have the behavior added to their acceptance criteria when they become `READY`. Owners: FW-114, FW-115. |
| F-9 | `SEC-DOS-003` (rate-limiting hooks) is not named in `docs/14`, and FW-206's title does not mention it. | low | Add to FW-206's acceptance criteria when it becomes `READY`. Owner: FW-206. |
| F-10 | AC-SEC-10 requires `SECURITY.md`, a private reporting channel, and a supported-version policy before public stable release. No checklist task names these artifacts; section 26's v1-RC gate implies FW-707. | medium | Owned by the FW-707 gate, but the artifact must be named explicitly. Requires a checklist amendment before M7 begins. Owner of the decision: FW-009. **Resolved by amendment A-1: FW-709 created and FW-707 now depends on it.** |
| F-11 | `SEC-FILE-004` (archive extraction, image processing, media transformation) is scoped to hardened plugins, none of which are planned in M0 through M7. | low | Conditional. Activates with the first such official plugin and is then covered by the plugin conformance kit. Owner: FW-603. |

## 7. Residual risk accepted at M0

- No security control is implemented or tested. Every row in section 4 is an obligation, not evidence. This is inherent to approving a threat model before any code exists.
- No continuous-integration run has been observed, so `SEC-SUPPLY-002` and `SEC-SUPPLY-003` cannot be exercised. Since amendment A-1 this is recorded as `AR-001` in `docs/SECURITY_ACCEPTED_RISKS.md`; amendment A-4 corrected the cause, which was originally stated as the absence of version control.
- The only security evidence produced so far is the escaping probe from FW-003, a single payload rather than the polyglot corpus that `SEC-XSS-*` requires.
- Section 24's response-window table is explicitly not a published guarantee and remains an internal target.

## 8. Amendments

This record was approved on 2026-08-15. Changes after approval are appended here rather than applied silently, per `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 4.

| ID | Date | Task | Change |
|---|---|---|---|
| A-1 | 2026-08-16 | FW-009 | Resolved the findings this record assigned to FW-009. `SEC-AUTH-003` now names FW-218, created by the FW-009 checklist amendment, closing F-6. `SEC-AUTH-004` moved from `none` to `conditional` and entered the conditional registry, closing F-7. `SEC-SUPPLY-002` and `SEC-SUPPLY-003` now cite `AR-001`. F-10 closed by creating FW-709 and adding it to FW-707's dependencies. Section 4's result paragraph gained a post-amendment count. No requirement, priority, or evidence type was weakened, and no row was removed. |
| A-2 | 2026-08-16 | FW-019 | Closed F-2. A tenth trust-boundary row, release artifact to consuming application, was added to `docs/09_SECURITY_PRD.md` section 6 with the controls `SEC-SUPPLY-002` and `SEC-SUPPLY-003` already state: provenance attestation, package-content review, lockfile integrity, no install scripts, license disclosure. The same row and the reasoning for its asymmetry are recorded in `docs/SUPPLY_CHAIN_POLICY.md` section 9. The `SEC-SUPPLY-002`, `SEC-SUPPLY-003`, and `SEC-SUPPLY-005` coverage rows now name the policy document as the specification their evidence is produced against. No requirement, priority, or evidence type was weakened, and no row was removed. |
| A-3 | 2026-08-16 | FW-018 | Recorded a constraint, transferred no ownership. `docs/STRICT_SECURITY_MODE.md` defines what fail-closed means as rules FC-1 to FC-10, and its section 5 is the complete inventory of the fourteen relaxations that `docs/09_SECURITY_PRD.md` permits, covering `SEC-INPUT-002`, `SEC-XSS-001`, `SEC-REQ-002`, `SEC-REQ-003`, `SEC-REQ-004`, `SEC-AUTH-003`, `SEC-CACHE-001`, `SEC-SECRET-002`, `SEC-SECRET-004`, `SEC-DEV-001`, `SEC-SUPPLY-005`, `SEC-SUPPLY-006`, `SEC-SSRF-003`, and `SEC-OBS-004`. Those rows keep the owners section 4 already gives them; FW-018 implements no control and is deliberately absent from every coverage row, so this amendment adds no row, changes no owner, and changes no planned evidence type. Section 1.1's statement that this record does not create a strict security mode remains true and is now discharged by a named document. ADR-008 exists as `Proposed` for the configuration surface and is not accepted authority. No requirement, priority, or evidence type was weakened, and no row was removed. |
| A-4 | 2026-08-17 | FW-005 | Corrected a factual error and narrowed a deferral. `AR-001` was recorded as "version control is not initialized"; version control is initialized and `main` tracks a remote, so the record's title, scope, rationale, and remediation were amended to state what is actually unexercised, which is the execution of `.github/workflows/ci.yml`. The correction is recorded on `AR-001` as an `Amended:` field rather than as a renewal, because correcting a false scope is not one of the three lifecycle actions in `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 6.4 and must not consume the one renewal that remains before escalation. The same stale clause was corrected in `docs/SUPPLY_CHAIN_POLICY.md` section 13, `docs/STRICT_SECURITY_MODE.md` sections 7 and 10, and section 7 of this record. Separately, the workflow's tier-1 matrix now covers every Node major that `docs/SUPPORT_POLICY.md` claims to support, so the `SEC-SUPPLY-002` and `SEC-SUPPLY-003` evidence, when it is produced, will cover the whole claimed support set rather than one version; the requirements remain undischarged and still cite `AR-001`. No requirement, priority, or evidence type was weakened, and no row was removed. |
