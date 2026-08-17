# Requirements Traceability Matrix

This matrix maps product requirements to implementation tasks and evidence. Agents must update it if requirement IDs or task IDs change. Requirement labels in this matrix are non-normative summaries; the linked primary PRD owns the normative definition. Every task reference is an explicit checklist ID.

| Requirement | Primary PRD | Initial tasks | Required evidence |
|---|---|---|---|
| FR-001 Project CLI | Compiler and DX | FW-115, FW-215 | Cross-OS create-to-page E2E |
| FR-002 Typed filesystem router | Routing | FW-004, FW-104–108 | Convention and module-API decisions: [docs/adr/ADR-003-route-filesystem-convention.md](adr/ADR-003-route-filesystem-convention.md) (`Accepted`) fixes the filesystem convention and its three amendments, [docs/adr/ADR-004-route-module-api-syntax.md](adr/ADR-004-route-module-api-syntax.md) (`Accepted`) fixes the route-module surface and its four commitments, both measured by `spikes/route-convention/results/route-convention-comparison.md` and enforced by `tests/route-convention.test.ts`; plus unit, type, and Routes-10k tests |
| FR-003 Rendering modes | Rendering | FW-112, FW-210, FW-301, FW-306, FW-401, FW-404 | Rendering conformance and bundle manifests |
| FR-004 Loader environment | Data | FW-203 | Server/client graph tests |
| FR-005 Safe mutations | Data and Security | FW-204, FW-503, FW-504 | Form E2E, schema, CSRF suite |
| FR-006 Web endpoints | Data and Architecture | FW-205 | Request/Response conformance |
| FR-007 Explicit cache | Data and Cache | FW-309, FW-505, FW-506, FW-507, FW-508, FW-509 | Inspector and cache conformance |
| FR-008 Adapter consistency | Adapters | FW-214 | Published conformance results |
| FR-009 Plugin extension | Plugins | FW-601–603 | External plugin fixture |
| FR-010 Actionable errors | DX | FW-006, FW-102 | Taxonomy and allocation evidence: [docs/adr/ADR-007-error-code-taxonomy.md](adr/ADR-007-error-code-taxonomy.md) (`Accepted`), [docs/ERROR_CODE_TAXONOMY.md](ERROR_CODE_TAXONOMY.md), machine-readable [docs/error-codes.json](error-codes.json), and `tests/error-taxonomy.test.ts`; plus FW-102 runtime diagnostic and remediation audit |
| FR-011 Build manifests | Architecture and Compiler | FW-107, FW-209 | Schema and reproducibility tests; the route manifest's input shape is fixed by [docs/adr/ADR-004-route-module-api-syntax.md](adr/ADR-004-route-module-api-syntax.md) commitment C1, which requires the manifest to be derived from analyzable named exports without executing application modules |
| FR-012 Private telemetry | Observability | FW-510, FW-607 | Opt-in and payload tests |
| FR-013 Security PRD | Security | FW-008, FW-009, FW-018, FW-019, FW-118, FW-119, FW-120, FW-121, FW-122, FW-123, FW-124, FW-207, FW-212, FW-213, FW-217, FW-218, FW-308, FW-310, FW-402, FW-406, FW-408, FW-504, FW-509, FW-603, FW-703, FW-709 | Security evidence index: [docs/SECURITY_THREAT_MODEL_APPROVAL.md](SECURITY_THREAT_MODEL_APPROVAL.md) is the approved requirement-level coverage baseline; [docs/SECURITY_EVIDENCE_WORKFLOW.md](SECURITY_EVIDENCE_WORKFLOW.md) defines how it is kept current, what qualifies as evidence, and the accepted-risk process; [docs/SECURITY_ACCEPTED_RISKS.md](SECURITY_ACCEPTED_RISKS.md) is the register of active deferrals; [docs/SUPPLY_CHAIN_POLICY.md](SUPPLY_CHAIN_POLICY.md) is the dependency, license, provenance, and publishing policy for the `SEC-SUPPLY-*` family; [docs/STRICT_SECURITY_MODE.md](STRICT_SECURITY_MODE.md) is the fail-closed rule set and the complete escape-hatch inventory that constrain every requirement family |
| NFR-001 No Node in universal | Architecture | FW-117 | Dependency and output scanner |
| NFR-002 TypeScript strict | Quality | FW-002, FW-005 | CI type check; the supported compiler range and the rule that strict mode is not configurable are fixed by [docs/adr/ADR-006-supported-runtime-and-typescript-policy.md](adr/ADR-006-supported-runtime-and-typescript-policy.md) (`Accepted`) commitments C6 to C8 and stated in [docs/SUPPORT_POLICY.md](SUPPORT_POLICY.md) section 4, enforced by `tests/support-policy.test.ts` |
| NFR-003 Reproducible builds | Compiler | FW-114 | Double-build hash test |
| NFR-004 Documented public API | DX and Quality | FW-701 | API report and docs compilation |
| NFR-005 Opt-in telemetry | Observability | FW-607 | No-network default test |
| NFR-006 Minimal dependencies | Security | FW-019, FW-701, FW-703 | Dependency policy evidence: [docs/SUPPLY_CHAIN_POLICY.md](SUPPLY_CHAIN_POLICY.md) section 4, enforced by `pnpm run deps:check` and `tests/supply-chain-policy.test.ts` |
| NFR-007 Secret-safe output | Security | FW-120, FW-212, FW-217, FW-504 | Canary-secret scans |
| NFR-008 Graceful shutdown | Adapters | FW-113, FW-122 | Signal and in-flight request test |
| NFR-009 Cross-platform development | Quality | FW-104, FW-115 | Windows/macOS/Linux CI; [docs/adr/ADR-003-route-filesystem-convention.md](adr/ADR-003-route-filesystem-convention.md) amendments A2 and A3 require folded case and Unicode route-key comparison and reserved-device-name rejection, measured on `win32` only so far and owed a re-run on macOS and Linux |
| NFR-010 ESM primary | Architecture | FW-005 | Package export tests; ESM-only distribution is commitment C1 and section 4 of [docs/SUPPORT_POLICY.md](SUPPORT_POLICY.md), which is why the Node floor in [docs/adr/ADR-006-supported-runtime-and-typescript-policy.md](adr/ADR-006-supported-runtime-and-typescript-policy.md) (`Accepted`) is pinned to the first release with unflagged `require(esm)` rather than to a major boundary, enforced by `tests/support-policy.test.ts` |
| NFR-011 Fail closed | Security | FW-018, FW-103, FW-107, FW-118, FW-119, FW-121, FW-124, FW-207, FW-212, FW-213, FW-406, FW-504, FW-509, FW-603 | Fail-closed definition: [docs/STRICT_SECURITY_MODE.md](STRICT_SECURITY_MODE.md) sections 4 and 4.1 supply rules FC-1 to FC-10 and the decision table that every owning task cites, section 5 is the complete escape-hatch inventory, section 6 forbids suppressing a security diagnostic, enforced by `tests/strict-security-mode.test.ts`; the configuration surface is proposed in [docs/adr/ADR-008-security-manifest-and-strict-mode.md](adr/ADR-008-security-manifest-and-strict-mode.md) and is not accepted authority yet; plus the per-task invalid-config security suite |

## Security traceability

The table below maps requirement families to their originating tasks. It is a summary, not the per-requirement map that AC-SEC-01 requires: several requirements are owned primarily by a task that does not appear in their family row. The requirement-level map, with the owning task and planned evidence type for each of the 63 `SEC-*` requirements, is [docs/SECURITY_THREAT_MODEL_APPROVAL.md](SECURITY_THREAT_MODEL_APPROVAL.md) section 4.

| Security area | Requirement families | Initial tasks | Evidence |
|---|---|---|---|
| Input and URL | SEC-INPUT-* | FW-118, FW-119 | URL corpus, traversal, limits |
| Rendering and XSS | SEC-XSS-* | FW-213, FW-402, FW-406 | XSS/CSP/browser corpus |
| CSRF, origin, redirects | SEC-REQ-* | FW-207, FW-504 | Browser and adapter suite |
| Auth boundaries | SEC-AUTH-* | FW-206, FW-504 | Request isolation and policy fixtures |
| Cache isolation | SEC-CACHE-* | FW-505–509 | Cross-user and poisoning suite |
| Secrets | SEC-SECRET-* | FW-120, FW-212 | Client/manifest/log scans |
| Development tooling | SEC-DEV-* | FW-121, FW-308 | Traversal/HMR/origin suite |
| Supply chain | SEC-SUPPLY-* | FW-019, FW-703 | Policy, provenance, publish verification: [docs/SUPPLY_CHAIN_POLICY.md](SUPPLY_CHAIN_POLICY.md) is the approved policy, enforced by `tests/supply-chain-policy.test.ts`, `pnpm run deps:audit`, and `pnpm run deps:licenses`; execution in continuous integration is deferred under `AR-001` |
| SSRF integrations | SEC-SSRF-* | FW-601, FW-602, FW-603, FW-701 | Private-address and redirect suite for applicable plugins |
| Uploads/assets | SEC-FILE-* | FW-122, FW-209, FW-603, FW-701 | Multipart/MIME/traversal suite for applicable integrations |
| Availability | SEC-DOS-* | FW-113, FW-122, FW-402 | Abort, limit, shutdown under load |
| Cryptography | SEC-CRYPTO-* | FW-123 | Static review and randomness tests |
| Observability/privacy | SEC-OBS-* | FW-510, FW-607 | Canary secrets and no-network default |
| Security headers | SEC-HEADER-* | FW-124, FW-406 | Header merge and browser suite |

## Subsystem acceptance-criterion traceability

| Acceptance criteria | Initial tasks | Required evidence |
|---|---|---|
| AC-ARCH-01–06 | FW-002, FW-005, FW-101, FW-107, FW-109, FW-117 | Dependency scans, manifest schema tests, request-isolation tests, capability diagnostics; the supported-runtime tiers that define which platforms those tests must cover are fixed by [docs/adr/ADR-006-supported-runtime-and-typescript-policy.md](adr/ADR-006-supported-runtime-and-typescript-policy.md) (`Accepted`) commitment C5 and tabulated in [docs/SUPPORT_POLICY.md](SUPPORT_POLICY.md) section 3, enforced by `tests/support-policy.test.ts` |
| AC-ROUTE-01–07 | FW-004, FW-104, FW-105, FW-106, FW-108, FW-118, FW-301, FW-302, FW-303, FW-304 | Unit/type fixtures, collision tests, Routes-10k results, malicious URL corpus, navigation browser tests |
| AC-RENDER-01–07 | FW-111, FW-112, FW-122, FW-210, FW-213, FW-306, FW-307, FW-401, FW-402, FW-404, FW-405, FW-406 | Production artifact scans, renderer conformance, serialization corpus, browser and concurrency tests |
| AC-DATA-01–06 | FW-203, FW-204, FW-213, FW-217, FW-501, FW-502, FW-503, FW-504 | Type tests, no-JS form E2E, validation/CSRF tests, stable-ID and redaction tests |
| AC-CACHE-01–05 | FW-505, FW-506, FW-507, FW-508, FW-509 | Cross-user, deterministic key, namespace, concurrency, poisoning, and regeneration suites |
| AC-COMP-01–07 | FW-102, FW-103, FW-114, FW-115, FW-121, FW-308 | Reproducibility, incremental build, diagnostics, HMR, cross-OS, and dev-server security tests |
| AC-ADAPT-01–05 | FW-113, FW-119, FW-122, FW-211, FW-212, FW-214 | Node/static conformance, secret scans, preview fidelity, traversal, abort, and cleanup tests |
| AC-PLUGIN-01–05 | FW-019, FW-601, FW-602, FW-603 | External plugin fixture, lifecycle diagnostics, bundle inspection, compatibility and malicious-plugin evidence; the plugin-dependency half is governed by [docs/SUPPLY_CHAIN_POLICY.md](SUPPLY_CHAIN_POLICY.md) section 4, while plugin capability declarations remain owned by FW-602 and FW-603 |
| AC-DX-01–05 | FW-006, FW-102, FW-215, FW-216, FW-309, FW-701 | Create-to-page E2E, diagnostic audit, production graph scan, docs CI, accessibility tests |
| AC-OBS-01–05 | FW-217, FW-510, FW-607 | No-vendor fixture, canary-secret scans, abort tracing, bounded labels, replaceable sink tests |
| AC-SEC-01–10 | FW-008, FW-009, FW-018, FW-019, FW-118, FW-119, FW-120, FW-121, FW-122, FW-123, FW-124, FW-207, FW-212, FW-213, FW-217, FW-218, FW-308, FW-310, FW-406, FW-408, FW-504, FW-509, FW-603, FW-701, FW-703, FW-705, FW-709 | Per-requirement security evidence index: [docs/SECURITY_THREAT_MODEL_APPROVAL.md](SECURITY_THREAT_MODEL_APPROVAL.md) (AC-SEC-01 baseline, enforced by `tests/security-coverage.test.ts`); evidence qualification, invalidation, and accepted-risk process: [docs/SECURITY_EVIDENCE_WORKFLOW.md](SECURITY_EVIDENCE_WORKFLOW.md) (enforced by `tests/security-evidence-workflow.test.ts`); AC-SEC-09 policy and workflow definition: [docs/SUPPLY_CHAIN_POLICY.md](SUPPLY_CHAIN_POLICY.md) (enforced by `tests/supply-chain-policy.test.ts`), with its provenance evidence pending a first publish under FW-703; AC-SEC-10 artifacts owned by FW-709; fail-closed rules and the escape-hatch inventory that constrain how every row above may be satisfied: [docs/STRICT_SECURITY_MODE.md](STRICT_SECURITY_MODE.md) (enforced by `tests/strict-security-mode.test.ts`), which claims no coverage row of its own; plus malicious-input corpora, production scans, adapter/browser/concurrency suites, provenance and vulnerability-process evidence |
| AC-PERF-01–06 | FW-007, FW-114, FW-407, FW-704 | One-command harness, raw artifacts, environment metadata, zero-byte proof, pinned comparisons, baseline regression gates |
| AC-QA-01–06 | FW-002, FW-117, FW-214, FW-603, FW-701, FW-703, FW-707 | Required CI gates, regression tests, API reports, consumable conformance packages, provenance, no skipped P0 security tests |

## Traceability rules

- Every subsystem acceptance criterion must be referenced by at least one task before its milestone begins.
- A task cannot be `DONE` without evidence mapped to its acceptance criteria.
- New requirements require an ID, priority, owner, task, and test plan.
- Removing a requirement requires an approved PRD change or ADR.
- Every release candidate includes an evidence index linking commit, CI, conformance, benchmark, security, API, documentation, and design-partner artifacts. Its required structure is [docs/SECURITY_EVIDENCE_WORKFLOW.md](SECURITY_EVIDENCE_WORKFLOW.md) section 7.3; FW-707 assembles it.

