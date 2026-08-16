# ADR-007: Error-code taxonomy

- Status: Proposed
- Date: 2026-08-17
- Owner: Core maintainers; drafted by GitHub Copilot (`gpt-pro`) under delegated autonomy
- Related tasks: FW-006, FW-102, FW-107, FW-215, FW-216, FW-309, FW-701, FW-703
- Security impact: high

## Context

The framework promises actionable, stable errors. `AGENTS.md`, `FR-010`, and
`docs/08_DX_AND_OBSERVABILITY.md` require a user-facing development error to carry a stable
code, a cause or concise explanation, a location when available, a concrete remediation, and a
documentation link. `docs/06_COMPILER_AND_DEV_SERVER.md` already fixes the structured diagnostic
shape and its three severities, and requires terminal output, browser overlays, JSON CI output, and
devtools to consume the same record. Production errors expose only a safe public code and request
ID.

The code namespace is not decided. `docs/08_DX_AND_OBSERVABILITY.md` labels
`DIAG-ROUTE-0042` illustrative only and explicitly delegates the final namespace to FW-006.
`docs/GLOSSARY.md` reserves numeric `FW-*` for checklist tasks, while `SEC-*`, `AC-*`, `ADR-*`,
`FR-*`, and `NFR-*` already identify requirements, acceptance criteria, decisions, and product
requirements. Reusing any of those namespaces would make diagnostics indistinguishable from
governance records in logs, searches, issue titles, and automation.

Codes are public API. Users search for them, CI groups by them, documentation gives them stable
URLs, and support processes use them as durable identifiers. The taxonomy therefore needs an
accepted ADR before FW-102 can publish the diagnostic model and formatters.

## Decision drivers

1. A code must remain stable when prose, formatting, source location, or implementation changes.
2. Humans must be able to recognize a NusaJS diagnostic and its owning subsystem at a glance.
3. Machines must be able to validate and parse the complete code without a registry lookup.
4. The namespace must remain distinct from checklist and requirements identifiers.
5. Subsystems need enough allocation space without a centralized counter for every new error.
6. Removing, reusing, or changing the meaning of a code must be governed as a public API change.
7. Production-safe codes must not reveal attacker-controlled input, filesystem layout, secrets, or
   internal implementation details.
8. Security diagnostics must preserve `docs/STRICT_SECURITY_MODE.md` section 6: only `error` or
   `warning`, and no suppression mechanism.
9. Plugins and adapters must not impersonate core diagnostics or create collisions.
10. Documentation URLs must be deterministic from the code.

## Options

### Option A — Flat sequential codes such as `NUSA-0042`

A project-wide prefix followed by a decimal sequence is compact and easy to parse. It does not
communicate ownership, requires one global allocator, creates frequent coordination for unrelated
packages, and makes a code's subsystem discoverable only through a registry. A gap or a high number
also carries no useful meaning.

### Option B — Hierarchical mnemonic codes such as `NUSA-ROUTE-0042`

A fixed project prefix, a registered subsystem token, and a fixed-width decimal identifier are
recognizable, grep-friendly, deterministic, and independently allocatable within each subsystem.
The subsystem token is routing metadata rather than severity or lifecycle state, so a code remains
stable when severity or presentation changes. The costs are longer codes, a governed subsystem
registry, and permanent tombstones for retired meanings.

### Option C — Package-derived codes such as `NUSA-CORE-E0042`

Including the package and severity appears precise but couples the public identifier to package
layout and classification. Moving an implementation between packages or correcting an `error` to a
`warning` would force a new code even when the diagnosed condition is unchanged. Package names are
also provisional until publication authority resolves ADR-001's scope.

### Option D — URI or namespaced string codes such as `nusajs://route/conflict`

Semantic strings are readable and practically unlimited. They are awkward in terminal output,
issue titles, telemetry dimensions, and environment variables; punctuation creates quoting and
escaping hazards; and synonyms make uniqueness harder to review mechanically. Turning the string
into a documentation URL also risks confusing an identifier with a transport location.

## Decision

**Proposed selection: Option B — hierarchical mnemonic codes.** This section is not accepted
authority until the ADR status becomes `Accepted`.

If accepted, the following commitments are binding:

1. **C1 — Grammar.** A core diagnostic code is exactly
   `NUSA-<SUBSYSTEM>-<NUMBER>`, matching `^NUSA-[A-Z][A-Z0-9]{1,11}-[0-9]{4}$`.
   ASCII uppercase is canonical; comparison is byte-for-byte and case-sensitive. The number range
   is `0001` through `9999`; `0000` is invalid.
2. **C2 — Meaning.** One code identifies one durable diagnosed condition, not one message template,
   call site, severity, exception class, or renderer. Parameters and locations may vary without
   changing the code. Materially different causes or remediations receive different codes.
3. **C3 — Registered subsystems.** The initial closed registry is `CLI`, `CONFIG`, `ROUTE`,
   `RENDER`, `DATA`, `CACHE`, `SERVER`, `ADAPTER`, `PLUGIN`, `SECURITY`, and `INTERNAL`. Adding or
   renaming a token is a public taxonomy change requiring an ADR amendment or superseding ADR.
4. **C4 — Allocation.** Numbers are unique within a subsystem and allocated monotonically by pull
   request. Gaps are allowed. A deleted or replaced code becomes a permanent tombstone and is never
   reused. Concurrent allocation conflicts fail CI and one pull request takes the next number.
5. **C5 — Stability.** Changing the meaning of a code or reusing a tombstone is a breaking public
   API change. Improving prose, remediation, documentation, redaction, or location precision is not
   breaking when the diagnosed condition remains the same. Correcting severity is reviewed as a
   behavior change and does not itself change the code.
6. **C6 — Required record.** The code registry records code, owning subsystem, summary, default
   severity, stability (`experimental` or `stable`), documentation slug, and status (`active` or
   `retired`). The runtime diagnostic still follows `docs/06_COMPILER_AND_DEV_SERVER.md`; the
   registry is allocation authority, not the wire shape.
7. **C7 — Documentation.** Every stable code resolves to `/errors/<code-lowercase>` on the official
   documentation origin. The diagnostic's `docs` field carries the complete documentation URL;
   formatters may display it but may not synthesize a different target. Experimental codes use the
   same path and display their stability on that page.
8. **C8 — Development and production.** Development presentations may include the structured
   message, safe cause, files, ranges, remediation, and documentation link. Production responses
   expose only a code explicitly classified safe for production and a request ID. A code alone is
   never treated as proof that its accompanying message or metadata is safe.
9. **C9 — Redaction.** Codes are static literals. No attacker-controlled value, route, path, origin,
   secret, request data, or generated hash may appear inside a code. Registry summaries and
   documentation slugs are static too. Production-safe classification requires a redaction test.
10. **C10 — Security diagnostics.** `NUSA-SECURITY-*` uses only `error` or `warning` under
    `docs/STRICT_SECURITY_MODE.md` section 6. No ignore comment, code allowlist, severity override,
    plugin hook, or global switch suppresses a security diagnostic. The code carries no suppression
    semantics.
11. **C11 — Extensions.** Official adapters and plugins request a registered core subsystem and
    allocation through the same registry. Third-party plugins use a separately typed extension
    identity supplied by FW-601; they may not mint `NUSA-*` codes. Until FW-601 decides that surface,
    third-party codes are opaque strings and formatters must label them non-core rather than
    accepting them as core.
12. **C12 — Internal failures.** `NUSA-INTERNAL-*` identifies a framework invariant failure, not a
    catch-all for an unclassified user error. Its development form includes a safe reporting path;
    its production form is redacted. An unknown thrown value does not receive a dynamically derived
    code.
13. **C13 — Serialization.** The code is a plain string in the shared structured diagnostic and in
    JSON output. Formatters do not encode severity, ANSI color, hyperlinks, or location into it.
14. **C14 — Automation.** FW-102 owns a mechanical registry validator for grammar, uniqueness,
    monotonic allocation, tombstones, registered subsystems, documentation links, and production
    redaction fixtures. FW-701 reports the exported code union as public API; FW-703 independently
    audits security-code suppression and production leakage.

## Consequences

Positive:

- A code can be recognized, searched, grouped, and routed to an owning subsystem without loading a
  registry.
- Package moves, formatter changes, and severity corrections do not churn identifiers.
- Independent subsystem sequences reduce allocation conflicts while one registry preserves global
  review and tombstones.
- A deterministic documentation path makes a missing page mechanically detectable.

Negative and honest:

- The namespace is longer than a flat counter and the 12-character subsystem cap is arbitrary.
- The initial subsystem boundaries may not survive implementation cleanly. Because codes are public,
  a poorly chosen boundary becomes permanent even when packages move.
- A four-digit sequence caps each subsystem at 9,999 conditions. That is intentionally finite so
  malformed or generated codes are easier to reject; exhausting it requires a superseding ADR.
- A central registry can become a merge-conflict hotspot despite per-subsystem counters.
- `NUSA` embeds the working codename. ADR-001 makes that codename accepted but provisional for
  publication; accepting this ADR before the public name is finalized creates migration cost if the
  name changes.

What becomes harder: changing framework identity, splitting or merging subsystem concepts, and
removing a diagnostic all require preserving aliases or tombstones. This is deliberate because a
code consumers depend on is not an implementation detail.

## Security analysis

Trust boundaries:

- application-controlled source, configuration, routes, headers, URLs, request data, and plugin
  output enter framework analyzers;
- the structured diagnostic crosses into terminals, browser overlays, JSON CI output, devtools,
  logs, telemetry, and potentially production responses;
- third-party plugins can attempt to impersonate core diagnostics or inject hostile display text.

Attacker inputs include filenames with terminal escapes, secrets in invalid configuration values,
malicious URLs, header values, thrown non-`Error` values, plugin-supplied strings, and request data.
The static-literal code grammar limits only the identifier. It does not sanitize `message`, `file`,
`hint`, `docs`, cause, or request ID, all of which require sink-specific encoding and redaction in
FW-102 and the owning subsystem.

Relevant requirements and controls:

- `SEC-OBS-001` and `SEC-OBS-002`: production diagnostics and observability must not leak sensitive
  values. C8 and C9 separate a safe public code from unsafe diagnostic metadata; FW-309 owns runtime
  redaction evidence.
- `SEC-SECRET-001`, `SEC-SECRET-003`, and `SEC-SECRET-004`: secrets must not enter client graphs,
  logs, or diagnostics. Static codes cannot contain values, and production-safe classification
  requires redaction tests.
- `SEC-XSS-003`: overlays and devtools are browser sinks. The taxonomy supplies no HTML and grants
  no trust to messages; FW-102 formatters must encode each field for its sink.
- `SEC-INPUT-001`: plugin and adapter codes remain untrusted input until validated. C11 prevents
  unregistered third-party strings from impersonating `NUSA-*`.
- `SEC-SUPPLY-001`: published diagnostic behavior is an advertised capability. C5, C6, and C14 make
  the claim inspectable and versioned.
- `docs/STRICT_SECURITY_MODE.md` section 6: C10 preserves the prohibition on `info` security
  diagnostics and on every suppression path.

Abuse cases:

1. A plugin emits `NUSA-SECURITY-0001` to impersonate the framework. The formatter validates origin
   and registry membership and labels an untrusted extension code non-core.
2. An invalid secret value is interpolated into a code or documentation slug. C9 forbids dynamic
   identifiers; value-bearing fields are separately redacted.
3. A production response serializes a full development diagnostic because the code is considered
   safe. C8 explicitly denies that inference and requires an allowlisted production-safe code plus
   a request ID only.
4. A team suppresses a security warning by code. C10 makes a suppression API non-conforming even
   though stable codes would otherwise make such an API convenient.

Residual risk: this ADR specifies a taxonomy but implements no validator, formatter, registry,
redaction test, browser escaping test, or production serializer. It discharges no `SEC-*`
requirement. Until FW-102 exists, codes remain prose and the production-safe classification has no
enforcement. The provisional public name is also an unresolved compatibility risk.

## Verification

Before this ADR may become `Accepted`:

- core maintainers approve the `NUSA` prefix despite ADR-001's provisional publication scope;
- at least route collision, invalid configuration, missing capability, unsafe relaxation, internal
  invariant, and production request-failure examples are assigned candidate codes to show the
  subsystem registry is neither ambiguous nor package-shaped;
- a prototype parser rejects lowercase, unknown subsystems, `0000`, overflow, dynamic suffixes, and
  third-party impersonation;
- a mock registry demonstrates duplicate detection, monotonic allocation, and permanent tombstones;
- the core maintainers decide whether experimental codes receive stability guarantees or may be
  removed without a tombstone.

After acceptance, FW-102 must provide runtime tests, type tests, JSON snapshots inspected for
semantic meaning, terminal and browser formatter tests, redaction fixtures, documentation-link
checks, and a public API report. FW-701 and FW-703 remain independent release gates.

Known limitations:

- no candidate-code exercise or parser prototype exists yet;
- no diagnostic registry exists;
- no framework package exists in which to define the type;
- no production serializer exists, so the safety classification cannot be measured;
- `docs/06_COMPILER_AND_DEV_SERVER.md`'s current `Diagnostic` interface has `message`, `hint`, and
  `docs`, but no explicit `cause`, `remediation`, `requestId`, stability, or production-safety field;
  FW-102 must reconcile that shape without treating this ADR as permission to invent a public API;
- ADR-008 remains `Proposed`, so this ADR preserves current severity rules and makes no claim about
  a future mode's effect.

## Rollback or supersede plan

Before publication, reject this proposal and reserve ADR-007 with no implementation. After
acceptance but before a stable release, a superseding ADR may select another prefix or grammar and
must migrate every registry entry, test, documentation path, and example atomically. After a stable
release, existing codes and tombstones remain recognized indefinitely; a new taxonomy requires an
explicit versioned alias map and migration guidance. A prefix change caused by finalizing the public
framework name is not a search-and-replace operation because users may persist codes in alerts,
dashboards, issue links, and automation.
