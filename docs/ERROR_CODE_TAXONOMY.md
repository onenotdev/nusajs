# Error-code taxonomy

This document is the allocation policy and reviewable registry guide for FW-006. The binding
architecture decision is [ADR-007](adr/ADR-007-error-code-taxonomy.md). Runtime diagnostic types,
formatters, production serialization, and complete documentation URLs remain owned by FW-102.

## Core grammar

A core code is exactly `NUSA-<SUBSYSTEM>-<NUMBER>` and matches
`^NUSA-[A-Z][A-Z0-9]{1,11}-[0-9]{4}$`. Numbers range from `0001` to `9999`; `0000` is invalid.
Comparison is ASCII, byte-for-byte, and case-sensitive.

The closed subsystem vocabulary is `CLI`, `CONFIG`, `ROUTE`, `RENDER`, `DATA`, `CACHE`, `SERVER`,
`ADAPTER`, `PLUGIN`, `SECURITY`, and `INTERNAL`. Adding or renaming a subsystem requires an ADR
amendment or superseding ADR. Third-party extensions must not mint `NUSA-*` codes.

## Allocation workflow

1. Select the subsystem by diagnosed condition, not by the package or call site that detects it.
2. Check [error-codes.json](error-codes.json), including retired entries.
3. Allocate one greater than the highest number ever allocated in that subsystem. Gaps remain gaps.
4. Add all required fields: `code`, `subsystem`, `summary`, `defaultSeverity`, `stability`,
   `documentationSlug`, and `status`.
5. Add the diagnostic documentation page and tests in the implementing task. A stable code cannot
   ship until its page resolves on the official documentation origin.
6. Review concurrent allocations. A collision fails CI; one pull request takes the next number.

Retirement changes only `status` to `retired` and preserves every identity field. Retired stable and
experimental entries are permanent tombstones. A code, number, meaning, or documentation slug is
never reused. Materially different causes or remediations receive different codes.

## Registry semantics

- `summary` describes one durable diagnosed condition and contains no runtime value.
- `defaultSeverity` is `error`, `warning`, or `info`; `SECURITY` permits only `error` or `warning`.
- `stability` is `experimental` or `stable` and does not weaken tombstone rules.
- `documentationSlug` is exactly `/errors/<code-lowercase>`; a formatter may not synthesize a
  different path.
- `status` is `active` or `retired`.

The registry is allocation authority, not a runtime wire format or proof of production safety. A
static code does not make a message, cause, path, location, remediation, request ID, or metadata
safe. Production exposure requires a separate allowlisted classification and redaction evidence
under FW-102 and the owning subsystem.

## Candidate exercises

The initial entries deliberately test boundaries before runtime implementation:

| Condition | Code | Why this subsystem |
|---|---|---|
| Two files resolve to one route pattern | `NUSA-ROUTE-0001` | The diagnosed condition is route identity, independent of scanner package. |
| Configuration value fails schema validation | `NUSA-CONFIG-0001` | The condition belongs to project configuration. |
| Active adapter lacks a required capability | `NUSA-ADAPTER-0001` | The mismatch is between framework capability demand and adapter support. |
| A security relaxation is used without its explicit declaration | `NUSA-SECURITY-0001` | It is a fail-closed security-control condition and cannot be suppressed. |
| A framework invariant is violated | `NUSA-INTERNAL-0001` | It is an implementation invariant, not a user-error catch-all. |
| A production request fails without a safe public classification | `NUSA-SERVER-0001` | The server boundary must return a generic safe code and request ID, not development details. |

`NUSA-ROUTE-0002` is a retired experimental exercise. It proves that validators include retired
entries in uniqueness and monotonic-allocation checks and that experimental removal creates a
permanent tombstone.

## Security rules

Codes and slugs are static literals. They never contain attacker-controlled values, routes, paths,
origins, secrets, request data, hashes, or thrown values. `NUSA-SECURITY-*` diagnostics cannot be
suppressed by comments, allowlists, severity overrides, plugins, or global switches. Unknown or
third-party strings are non-core even when they resemble this grammar.

This governance artifact implements no formatter, serializer, redaction control, or security
boundary and therefore discharges no `SEC-*` requirement.