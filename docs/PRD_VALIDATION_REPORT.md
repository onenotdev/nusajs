# FW-001 PRD Validation Report

Date: 2026-08-15  
Agent: GitHub Copilot (`gpt-pro`)  
Status: **DONE**

## Scope and method

The audit covered the complete Product Requirements Package: the master and security PRDs, product principles, subsystem PRDs, roadmap, positioning and decisions, requirements traceability matrix, execution playbook, and ordered checklist.

Validation checked:

1. Canonical terminology and overloaded terms.
2. Definition uniqueness for `FR-*`, `NFR-*`, `SEC-*`, and `AC-*` IDs.
3. Reference integrity for requirement, task, acceptance-criterion, and ADR identifiers.
4. Requirement-to-task and acceptance-criterion-to-evidence traceability.
5. Normative conflicts using the repository source-of-truth priority.
6. Security governance implications.

No framework code or dependency was introduced.

## Summary

| Area | Result | Evidence summary |
|---|---|---|
| Terminology consistency | PASS | Canonical definitions are recorded in the glossary and conflicting normative wording was corrected. |
| Unique requirement definitions | PASS | No exact duplicate `FR-*`, `NFR-*`, `SEC-*`, or `AC-*` definition with conflicting text was found. |
| Reference integrity | PASS | Prose placeholders were replaced by explicit task IDs and the illustrative diagnostic moved out of the `FW-*` namespace. |
| Explicit numeric task references | PASS | Every numeric `FW-*` task referenced by the traceability matrix exists in the checklist. |
| Acceptance-criterion traceability | PASS | Every subsystem `AC-*` family is directly mapped to explicit tasks and evidence. |
| Normative consistency | PASS | The roadmap now preserves the Master PRD's minimal v0.1 opt-in client-navigation requirement. |
| Conflicts recorded | PASS | This report records conflicts, precedence, required decisions, and safest next actions. |

## ID audit

### Definitions

- `FR-001` through `FR-013` have one normative definition in the Master PRD.
- `NFR-001` through `NFR-011` have one normative definition in the Master PRD.
- Security requirement IDs are unique within their `SEC-*` families.
- Product and subsystem acceptance-criterion IDs are unique within their namespaces.
- No conflicting duplicate definition was found.

### Resolved invalid or ambiguous references

1. The illustrative `FW-R042` diagnostic was changed to `DIAG-ROUTE-0042` and explicitly marked non-normative pending the error-taxonomy task.
2. `SEC tasks across milestones` in the `FR-013` mapping was replaced by explicit `FW-*` task IDs.
3. `continuous`, `subsystem tasks`, and `plugin-specific` task-column placeholders were replaced by explicit `FW-*` task IDs.
4. Checklist dependencies `official adapters` and `FW-702–706` were expanded to explicit task IDs. The FW-701 milestone predicate is explicitly prohibited from becoming `READY` until expanded to then-applicable task IDs.
5. `ADR-001` through `ADR-017` are explicitly marked `RESERVED`, not accepted authority. Future ADR files carry their lifecycle status.

### Traceability coverage

The matrix maps top-level `FR-*`, `NFR-*`, security families, and every subsystem acceptance-criterion family to explicit tasks and required evidence.

The audit corrected these mappings:

- `FR-003` must include the client-rendering/hydration work needed by its required client mode.
- `FR-007` promises inspector evidence but omits the inspector tasks.
- `NFR-007` should include canary-secret scanning and production redaction work.
- `NFR-008` and `SEC-DOS-004` should include explicit shutdown, deadline, abort, and cleanup tasks.

Public protocol and API details remain correctly deferred to their governing ADR tasks; this does not leave an unresolved requirement or traceability conflict.

## Terminology findings

Canonical definitions are in `docs/GLOSSARY.md`. The audit found and resolved or explicitly qualified these terms:

1. `action`, `mutation`, and `state-changing operation` are used without an explicit relationship.
2. `static` means a route segment, build-time rendering, output artifacts, and a deployment adapter.
3. `server`, `SSR`, and `stream` mix rendering location with delivery strategy.
4. `island` is used both as a route mode and as a component hydration boundary.
5. `client capability` is central to the zero-JavaScript guarantee but lacks a taxonomy.
6. `runtime` is overloaded across framework server/client behavior and deployment hosts.
7. `adapter`, `runtime adapter`, and `static adapter` lack a canonical umbrella term.
8. Plugin execution phases and trust classes are not explicit.
9. Loader/client-loader boundary semantics are not defined.
10. Cache policy names, cache layers, and HTTP `no-store` behavior are conflated.
11. Product telemetry and application observability are not consistently distinguished.
12. Inspector, devtools, overlay, and diagnostics UI are not separately defined.
13. `0 KB` is weaker than exactly zero bytes for the zero-framework-JavaScript requirement.
14. `Web-Standard` and `Web Standards` spelling varies.

The glossary resolves terminology at the requirements level. Public API names remain subject to their governing ADRs and therefore are not prematurely frozen by FW-001.

## Conflict ledger

### PRD-CONFLICT-001 — Client navigation release scope

**Severity:** Resolved  
**Sources:** Master PRD v0.1 scope; roadmap M3 v0.2-alpha  
**Conflict:** The Master PRD includes opt-in client navigation in v0.1, while the roadmap places client-navigation work in v0.2-alpha.  
**Precedence:** The Master PRD wins.  
**Resolution:** Preserve the higher-priority Master PRD. The roadmap now defines a minimal opt-in v0.1 baseline; v0.2 contains enhancements and hardening. The protocol remains gated by FW-301's ADR before implementation.

### PRD-CONFLICT-002 — Security precedence wording

**Severity:** High governance ambiguity  
**Sources:** Repository source priority; Security PRD purpose  
**Conflict:** The Security PRD says it takes precedence over other PRDs for security/privacy, while repository priority places the Master PRD first.  
**Resolution by precedence:** The Master PRD remains first; subject to it, the Security PRD outranks product principles and subsystem PRDs for security/privacy.  
**Resolution:** Security PRD wording now states that its precedence is subject to the Master PRD.

### PRD-CONFLICT-003 — P1 security completion exception

**Severity:** Medium  
**Sources:** Security requirement classification; v1 release-candidate gate  
**Conflict:** P1 is described as mandatory before beta/stable, while the v1 gate permits an accepted-risk exception.  
**Resolution:** P1 is required before its applicable gate unless an authorized accepted-risk record has an owner, deadline, rationale, and compensating controls.

### PRD-CONFLICT-004 — Rendering dimensions

**Severity:** Architecture decision required  
**Sources:** Product principle “static until dynamic”; rendering-mode table and streaming/islands sections  
**Conflict:** `static`, `server`, `client`, `island`, and `stream` combine rendering location, hydration scope, and delivery strategy in one mode list.  
**Resolution:** Requirements now model rendering location, hydration policy, and delivery strategy as orthogonal dimensions.  
**Authority required:** Accepted renderer/render-mode ADR before public API implementation.

### PRD-CONFLICT-005 — Security benchmark controls

**Severity:** High if misapplied  
**Sources:** Performance benchmark B11; fail-closed security requirements  
**Conflict:** B11 contemplates disabled controls without limiting which controls may be disabled.  
**Resolution:** B11 now prohibits disabling P0 or invariant security controls and prohibits treating unsafe results as deployable guidance.

### PRD-CONFLICT-006 — Public environment declaration

**Severity:** Security-sensitive wording mismatch  
**Sources:** Adapter PRD; Security PRD `SEC-SECRET-002`  
**Conflict:** Adapter wording could permit prefix-only exposure; security requires explicit declaration and schema validation.  
**Resolution:** Adapter requirements now require explicit declaration, schema validation, and security-manifest visibility; a prefix alone is insufficient.

## Security impact review

**Impact:** Low, documentation/governance only.

**Protected assets affected indirectly:** secrets, request-local state, cache isolation, build artifacts, manifests, development tooling, and release integrity, because ambiguous requirements can lead to unsafe later implementation.

**New trust boundaries or attacker-controlled inputs:** None.

**Relevant requirements:** All `SEC-*` families were checked for unique IDs and traceability. Specifically relevant governance requirements are `SEC-SUPPLY-001` through `SEC-SUPPLY-006`, the security testing program, and the release-gate requirement that every P0 security requirement have evidence.

**Security evidence:** Manual cross-document audit. No runtime security test applies because no executable code or trust boundary changed.

**Residual risk:** P0 security evidence is currently mapped by broad requirement family rather than by each individual requirement. This is acceptable during discovery but must be corrected before the governing milestones and releases.

## Resolution authority

The user directed autonomous continuation and good engineering judgment. Source priority selected the least-surprising resolution: preserve the Master PRD and clarify the roadmap rather than silently reducing v0.1 scope.

No architecture ADR was created because FW-001 only reconciles requirements. Rendering APIs and the client-navigation protocol still require their already planned ADR tasks before implementation.

## Verification performed

- Complete manual reading of the mandatory Product Requirements Package and relevant subsystem documents.
- Cross-reference audit of requirement, acceptance-criterion, task, and ADR namespaces.
- Numeric task-reference comparison between the traceability matrix and checklist.
- Source-priority review of material inconsistencies.
- Repository assessment: documentation-only repository; no package manager or framework toolchain; Git is not initialized; no dependencies installed.

## Acceptance criteria

- **AC-1 — terminology is consistent:** PASS. A canonical glossary exists and conflicting normative usages were corrected or explicitly qualified.
- **AC-2 — requirement IDs are consistent:** PASS. Definitions are unique, task references are explicit and resolvable, and subsystem acceptance criteria map to tasks and evidence.
- **AC-3 — conflicts are recorded:** PASS. The conflict ledger records sources, precedence, proposed resolution, required authority, and safest next action.

## Completion decision

**Status: DONE**

All FW-001 acceptance criteria pass. Architecture and public API choices remain assigned to their existing future ADR tasks and are not implementation blockers for this documentation-validation task.
