# ADR-008: Security-manifest schema and strict-mode behavior

- Status: Proposed — part 1 of 2. Part 1 (strict-mode behavior) is proposed by FW-018 and may be accepted on its own. Part 2 (security-manifest schema) is deliberately undecided and is owned by FW-107.
- Date: 2026-08-16
- Owner: Repository owner. Part 1 drafted by GitHub Copilot (`gpt-pro`) under delegated autonomy; acceptance is reserved to the core maintainers under `docs/12_ROADMAP_AND_RELEASES.md` governance.
- Related tasks: FW-018 (part 1), FW-107 (part 2), FW-103, FW-121, FW-124
- Security impact: high

## Context

`docs/13_POSITIONING_RISKS_AND_DECISIONS.md` reserves ADR-008 for "Security-manifest schema and strict-mode behavior" and states that a reserved ID "is not accepted authority until a corresponding ADR file has status `Accepted`". No file existed, so the reservation was an unowned decision.

FW-018 must define the strict security mode and the fail-closed policy. Most of that work is requirement interpretation and carries no API: `docs/09_SECURITY_PRD.md` objective SO-04 already states that "invalid or unsupported security configuration fails closed" and that "framework behavior must not silently downgrade protection", and `docs/00_MASTER_PRD.md` NFR-011 already states that "security controls fail closed for unsupported or invalid configurations". Those obligations exist whether or not this ADR is accepted, and `docs/STRICT_SECURITY_MODE.md` records them.

One part of FW-018's subject matter is not interpretation. `docs/06_COMPILER_AND_DEV_SERVER.md` already publishes a configuration example containing `security: { mode: "strict" }`. That example fixes the property path and one legal value but answers none of the questions an implementation needs:

- Which values are legal besides `"strict"`?
- Which value is the default when the key is absent?
- Is the mode application-wide, per route, or per control?
- Does the mode change which controls run, or only the severity of the diagnostics they produce?
- What happens to the mode when an adapter reports a required capability as `emulated` or `unsupported`?

Those are public-API and architecture questions. Under `AGENTS.md` they require an ADR before implementation, so this record exists and the questions stay open rather than being settled implicitly by whichever task reaches the config loader first.

Part 2, the security-manifest schema, shares this ID because `docs/02_ARCHITECTURE.md` lists `security-manifest.json` and requires that "every manifest has an independent schema version", and because the mode must be visible in that manifest. FW-018 does not touch manifests, produces no schema, and must not pre-empt FW-107, so part 2 is recorded as deferred rather than answered badly.

## Decision drivers

- SO-04 forbids a silent downgrade, so a mode that can weaken a control has to be a deliberate, visible, recorded act.
- SO-05 requires that risk be visible, so whatever the mode does must be inspectable in the security manifest.
- A mode value that turns controls off is a single switch that disables security across an application. R-12, "security scope is treated as optional", is rated `Critical` in `docs/13_POSITIONING_RISKS_AND_DECISIONS.md`, and a coarse off switch is the most likely way that risk is realized.
- `docs/01_PRODUCT_PRINCIPLES_AND_USERS.md` and the accepted trade-off "v0.x prioritizes correctness, security, and inspectability over the shortest API" both favor fewer legal values over more.
- The key already appears in a normative subsystem document, so removing it entirely is a PRD change and not merely an ADR.
- v0.x must not paint itself into a corner: whatever is chosen has to leave room for a second mode later without a breaking change.

## Options

### Option A — No mode key at all

Delete `security: { mode: "strict" }` from `docs/06_COMPILER_AND_DEV_SERVER.md`. Every control is unconditionally strict, and every relaxation is per-site: an allowlist entry, an explicitly named unsafe API, an explicit flag.

Benefits: the smallest possible surface; no coarse switch can exist, so R-12's most dangerous form is structurally impossible; nothing has to be versioned in the manifest; no migration is needed because nothing is implemented yet.

Disadvantages: requires editing a normative subsystem PRD, which is a larger change than an ADR and which `AGENTS.md` says needs a decision rather than an agent's preference. It also leaves no declared home for future application-wide security posture, so the first task that needs one will re-open this decision under time pressure. Applications gain no single place to state intent, and the security manifest loses an obvious anchor for the posture it reports.

Compatibility and maintenance: cheapest today, most expensive if a second posture is ever needed.

### Option B — Two modes: `"strict"` by default and a `"compatible"` opt-out

`security.mode` accepts `"strict"` or `"compatible"`. `"strict"` is the default. `"compatible"` relaxes a documented set of controls at once — for example, accepting cross-origin state-changing requests without explicit CORS configuration, or downgrading header-merge conflicts from error to warning.

Benefits: familiar; gives migrating applications a single lever; makes the posture explicit in configuration and easy to record in a manifest.

Disadvantages: it is exactly the coarse off switch that R-12 predicts. Once `"compatible"` exists, the fastest fix for any security diagnostic is to switch the whole application, and the relaxation is invisible at the site where the risk actually lives. It also conflicts with the fail-closed policy's rule that a relaxation must be local and must name what it relaxes, and with SO-04's prohibition on downgrading protection, since a single value would downgrade several controls at once. The set of controls affected becomes a compatibility surface that has to be versioned and can never shrink without a breaking change.

Compatibility and maintenance: easy to adopt, hard to ever remove, and it moves security decisions away from the code they protect.

### Option C — `security.mode` exists with `"strict"` as its only legal value in v0.x

`security.mode` is a declared, schema-validated, manifest-recorded property whose only legal value in v0.x is `"strict"`. Absence of the key means `"strict"`. Any other value is a configuration error that fails the build with the property path, the received value, and the legal set, per the schema-error rule in `docs/06_COMPILER_AND_DEV_SERVER.md`. The mode never turns a control off and never changes which controls run. Every relaxation stays per-site, in the form the owning `SEC-*` requirement prescribes, and appears in the security manifest individually.

Benefits: keeps the published property path, so no normative PRD text has to change; keeps the door open for a future second value behind its own ADR and its own manifest schema version; makes the coarse off switch impossible in v0.x without making it impossible forever; gives the security manifest a stable place to record the declared posture; and matches the fail-closed policy without exception.

Disadvantages: a property with one legal value looks like ceremony, and reviewers will ask why it exists; it offers migrating applications no lever, so an application that cannot satisfy a control must relax it at each site, which is more work than flipping one value — deliberately so, and a real adoption cost; and it defers rather than settles the question of what a second posture would mean.

Compatibility and maintenance: adding a value later is additive and requires a manifest schema bump plus an ADR superseding this one. Removing the key later is breaking, which argues for keeping it.

## Decision

**Proposed: Option C.** Not accepted. Nothing may be implemented against this section until the status line reads `Accepted`.

Proposed terms:

- `security.mode` is a declared configuration property. Its only legal value in v0.x is `"strict"`.
- An absent `security.mode` means `"strict"`. There is no unset or inherited state.
- Any other value, including a case variant, is a configuration error that fails the build. It is not corrected, coerced, or warned past. This follows rule FC-3 of `docs/STRICT_SECURITY_MODE.md`.
- The mode does not select which controls run. It is a declaration of posture, not a feature switch, and in v0.x it cannot weaken any control.
- The mode does not change the severity of any diagnostic in v0.x, because there is only one mode. Severity promotion is therefore not part of this proposal and remains available to a future mode.
- Every relaxation permitted by a `SEC-*` requirement stays per-site and keeps the form that requirement prescribes. Section 5 of `docs/STRICT_SECURITY_MODE.md` is the inventory.
- The declared mode and every active per-site relaxation are recorded in the security manifest by name, without values, under whatever schema part 2 defines.
- A second legal value requires an ADR that supersedes this one, a security-manifest schema major version, and an entry in the release notes.

**Part 2 — security-manifest schema — is not decided here.** FW-018 produces no manifest, no schema, and no field names, and the coverage rows for `SEC-SECRET-002` and the manifest requirements keep FW-107 and FW-212 as their owners. FW-107 appends a part 2 section to this record. Part 1 may be accepted before part 2 exists; part 2 may not be accepted without part 1.

## Consequences

Positive: the reserved ID stops being an unowned decision. The configuration property that `docs/06_COMPILER_AND_DEV_SERVER.md` already advertises acquires a defined meaning, a defined default, and a defined failure behavior. FW-103 gains an unambiguous validation rule for one property instead of inventing one. R-12's coarse-switch failure mode is structurally absent from v0.x. The choice is additive, so a future posture is not foreclosed.

Negative: FW-018 completes with this record still `Proposed`, so the policy document has to mark its mode-dependent clauses as conditional, and a reader must consult two documents to learn the whole rule. A one-value enumeration will read as over-engineering to anyone who has not read this context, and the drivers must stay attached to it or the value will be deleted as dead weight. Applications with a genuine incompatibility get no fast path and will feel that friction before v1. If the maintainers prefer Option A, `docs/06_COMPILER_AND_DEV_SERVER.md` needs an edit that this task deliberately did not make.

Migration: none. No configuration loader, schema, or manifest exists yet, which is the cheapest possible moment to decide this.

## Security analysis

Affected trust boundaries: adapter to host, environment to client graph, and browser to server, as listed in `docs/09_SECURITY_PRD.md` section 6. The mode is the declaration that describes the posture applied at all three; it is not itself a control.

Relevant requirements: SO-04 and SO-05 directly. `SEC-SECRET-002` requires that declarations remain visible in generated security manifests, which is why the mode is recorded rather than merely honored. `SEC-HEADER-002` forbids silently weakening a stricter policy, which Option B would have institutionalized. `SEC-CACHE-001`, `SEC-REQ-002`, `SEC-REQ-003`, `SEC-REQ-004`, `SEC-DEV-001`, and `SEC-AUTH-003` each define their own explicit relaxation, and Option C leaves every one of them where the requirement put it.

Abuse cases: the relevant one is not in `docs/09_SECURITY_PRD.md` section 22, because it is not an attacker action. It is a developer under deadline pressure disabling a control to make a build pass — the "misconfigured developer or operator" actor in section 5. Option B serves that actor's shortest path; Option C removes it.

Controls: a closed value set validated at build time; failure rather than coercion on an unknown value; per-site relaxation only; manifest visibility for the declared posture and for every relaxation.

Residual risk: a future second mode could reintroduce every disadvantage of Option B, and this record cannot prevent that — it can only require an ADR, a schema bump, and release notes first. The manifest visibility this proposal depends on does not exist until FW-107, so between acceptance and FW-107 the declared posture is validated but not published. Part 2 remains an open reserved decision, so ADR-008 is not fully discharged by this file.

## Verification

Part 1 is verifiable when FW-103 exists: a schema test asserting that `"strict"` and an absent key both resolve to `"strict"`, that every other value fails the build with the property path and the legal set, and that no code path treats the mode as a control toggle. Until then the only evidence available is documentary, and `tests/strict-security-mode.test.ts` asserts the documentary part — that this record exists, that its status is one of the permitted values, that the policy document's conditional clauses cite it, and that the reserved-ID list in `docs/13_POSITIONING_RISKS_AND_DECISIONS.md` points at this file. Under `docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.1 that is not evidence for a control, and this ADR claims none.

## Rollback or supersede plan

If the maintainers prefer Option A, this record is superseded by an ADR that removes the property, and `docs/06_COMPILER_AND_DEV_SERVER.md` loses the `security` key from its configuration example. If a second posture is needed, a superseding ADR states the value, the exact set of controls it changes, why each change is acceptable, the security-manifest schema major version that reports it, and the release note. Because Option C is additive, neither path requires a change to `docs/STRICT_SECURITY_MODE.md` sections 4 or 5.
