# Route convention and module API evaluation spike (FW-004)

This directory is a **throwaway measurement spike**. It exists so that ADR-003
(route filesystem convention) and ADR-004 (route-module API syntax) are decided from
observed behaviour rather than taste, as `docs/03_ROUTING_AND_NAVIGATION.md` requires:
"The final convention requires an ADR after a prototype evaluates discoverability,
collisions, generated types, and cross-platform filesystem behavior."

Four rules apply to everything in here:

1. It is not a framework package. It lives outside `packages/*` and is `private`.
2. Nothing here is public API, and no framework code may import it.
3. It is deletable the moment ADR-003 and ADR-004 are superseded.
4. Its numbers are structural counts and filesystem observations, never performance
   claims.

## What it measures

| Axis | Method |
| --- | --- |
| Discoverability | Counts the reserved names each convention introduces, against the PRD goal "expressive without creating excessive special names". |
| Aliasing surface | Enumerates every legal path that spells one URL. More than one spelling per URL is an aliasing surface. |
| Collisions | Runs five collision fixtures per convention and checks that each is either reported with **every** conflicting file named (AC-ROUTE-02) or unexpressible by construction. |
| Precedence | Computes a specificity key per pattern and reports any pair that overlaps yet ties, because filesystem enumeration order may not decide precedence. |
| Cross-platform filesystem | Writes the candidate trees to a real temporary directory and probes case folding, Unicode NFC/NFD folding, and Windows reserved device names (NFR-009, SEC-INPUT-003, SEC-INPUT-004). |
| Static analyzability | Parses route-module fixtures with the TypeScript parser only — no program, no execution — and records whether route configuration is recoverable, per `docs/06_COMPILER_AND_DEV_SERVER.md`. |
| Diagnostic behaviour | Feeds each module API a computed, unanalyzable initialiser and checks it yields a diagnostic instead of being resolved by execution. |
| Analyzer fragility | Compares a name-only callee matcher against a binding-resolving one on an aliased import, to expose silent misses. |

The collision, diagnostic, and analyzability checks are **enforced, not merely
reported**: the harness exits non-zero if any candidate fails them, so a broken
fixture cannot be mistaken for a successful measurement.

## Run it

```powershell
cd spikes/route-convention
node ./measure.mjs
```

Results are written to `results/route-convention-comparison.json` and
`results/route-convention-comparison.md`.

## What the numbers are and are not

Reserved-name counts, spelling counts, collision outcomes, precedence ties, and
analyzer step counts are deterministic and reproduce byte-for-byte on identical
inputs. They are structural facts about the conventions, not benchmarks.

Filesystem probe results are **specific to the platform that ran the harness**. The
committed report was produced on `win32`. No claim may be made about macOS or Linux
behaviour until the harness has been re-run there. A convention must be safe under the
union of all supported platforms, so a hazard observed on any one platform counts
against it everywhere.

**No performance or match-time claim may be published from this spike.** Route
match-time budgets belong to FW-106 and the 10,000-route AC-ROUTE-06 fixture.

The `fixtures/module-api/*.ts` files import `@nusajs/core`, which does not exist yet.
That is deliberate: the harness parses them as text and never resolves the import, so
the fixtures document the intended author-facing shape without depending on unwritten
code. They are excluded from the root TypeScript project for the same reason.
