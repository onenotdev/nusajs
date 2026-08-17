# ADR-031: Canary-Secret Scanning Boundary

- Status: Proposed
- Date: 2026-08-18
- Owner: framework maintainers
- Related tasks: FW-120, FW-107, FW-114, FW-212, FW-217
- Security impact: high

## Context

Production bundles, manifests, source maps, logs, and traces are secret-bearing sinks. Source-only
inspection cannot prove that a build transform, serializer, or later plugin did not emit a known
test canary. The security PRD therefore requires deterministic canary scanning of built production
artifacts. The existing private Vite integration has no final-output inspection lifecycle.

## Decision drivers

- Inspect the bytes consumers receive rather than decoded or pre-transform source.
- Fail closed without exposing the canary, matching bytes, host paths, or filesystem causes.
- Bound filesystem work and reject aliases or unsupported entry types.
- Keep build tooling out of the universal core and avoid a premature public scanner API.
- Preserve direct Vite usage while ensuring a failed scan prevents the official CLI success signal.

## Options

1. Scan source modules during transformation. This misses generated HTML, CSS, manifests, source
   maps, public copies, and mutations by later plugins.
2. Scan Rollup's in-memory bundle. This is deterministic but is not necessarily the final on-disk
   representation.
3. Scan the final output tree from a post-enforced build lifecycle. This covers every regular file
   present when Vite completes output finalization and rejects the build before it resolves.

## Decision

Adopt option 3 in the private Node-only `@nusajs/compiler` package. The existing Vite plugin accepts
an opt-in list of explicit ASCII canaries, defensively copies and validates them before build work,
then scans the final output tree from a post-enforced `closeBundle` hook. Matching is exact bytes:
there is no decoding, normalization, case folding, heuristic credential detection, suppression,
allowlist, severity override, or insecure bypass.

The scanner uses fixed framework limits: at most 32 canaries, 256 bytes per canary, 10,000 files,
16 MiB per file, 256 MiB in aggregate, and 64 directory levels. Invalid input, missing output,
unreadable entries, links, non-regular entries, limit exhaustion, and a finding all fail closed.
Diagnostics use `NUSA-SECURITY-0002` and disclose only a static artifact class and ordinal. They never
include a filename, offset, canary index/value/hash, excerpt, absolute path, or caught cause.

Canaries remain in plugin-local memory and never enter plugin state, generated manifests, source
maps, or serialized configuration. No low-level scanner API is exported. The official CLI already
prints success only after `vite.build()` resolves, so a scanner hook failure prevents success without
changing the CLI diagnostic transport. Later sink-owning tasks may add private adapters around the
same scanner only after defining their sink lifecycle.

## Consequences

Direct Vite production builds can enforce exact canaries without a new dependency, and source maps
are covered as opaque bytes even when malformed. Scanning is intentionally opt-in because the
framework cannot infer arbitrary credentials; CI fixtures and later taint/redaction tasks must supply
the canaries they inject. A hostile plugin ordered after this plugin's `closeBundle` hook could write
after the scan. Official plugin ordering and output-root capabilities must close that residual before
third-party plugins are called supported; the current private build has no public plugin contract.

## Security analysis

The new trust boundary is recursively reading generated output. Lexical and canonical containment,
`lstat()` no-follow checks, regular-entry enforcement, deterministic traversal, and fixed resource
limits address traversal, link aliasing, special files, nondeterminism, and resource exhaustion.
Path replacement races remain a local-machine residual shared with ADR-030. Static diagnostics avoid
turning malicious output names or contents into a disclosure sink.

## Verification and supersede plan

Unit tests cover exact matching, defensive copies, invalid canaries, clean and matching binary
artifacts, source-map-only findings, links, missing output, limits, deterministic ordering, and
diagnostic redaction. Real Vite builds prove final JavaScript and source-map scanning blocks build
completion. Type tests pin the private option shape. Superseding this decision requires equivalent
final-byte, redaction, no-suppression, resource-limit, and cross-platform evidence.