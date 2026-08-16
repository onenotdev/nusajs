# ADR-003: Route filesystem convention

- Status: Accepted
- Date: 2026-08-16
- Owner: Lead founding engineer (agent: GitHub Copilot, `gpt-pro`)
- Related tasks: FW-004, FW-104 (filesystem route scanner), FW-105 (route parser and collision detection), FW-107 (route and security manifests), FW-119 (filesystem root, traversal, and symlink evidence)
- Security impact: medium

## Context

`docs/03_ROUTING_AND_NAVIGATION.md` proposes a filesystem route tree and then
explicitly withholds authority from it: "The final convention requires an ADR after a
prototype evaluates discoverability, collisions, generated types, and cross-platform
filesystem behavior." The convention is therefore an open P0 question, reserved as
ADR-003 in `docs/13_POSITIONING_RISKS_AND_DECISIONS.md`.

The decision is required now because FW-104 scans the route directory, FW-105 parses
what FW-104 found and reports collisions, and FW-107 serialises the result into
`route-manifest.json`. All three are M1 P0 tasks and none of them can be specified
without knowing what a route file looks like. M0 exit additionally requires "at least
two architecture paths compared with evidence" and "no unowned P0 question".

Three constraints shape the answer more than aesthetics do:

1. `NFR-009` requires development on Windows, macOS, and Linux. A convention that
   encodes routing meaning into path text inherits every filesystem-specific
   behaviour of those three platforms.
2. The routing PRD states "Ambiguous or colliding patterns fail at build time.
   Filesystem enumeration order may not decide precedence." Precedence must be a pure
   function of the parsed pattern.
3. `SEC-INPUT-004` forbids concatenating untrusted URL paths into filesystem access,
   and the routing PRD restates it: "Never derive filesystem paths directly from
   unmatched URL strings." A filesystem-shaped convention makes the URL and the path
   look alike, which makes that mistake easy to write and easy to miss in review.

FW-004 therefore built a throwaway measurement spike at `spikes/route-convention/`
rather than copying a convention from a well-known framework. The spike expresses one
fixed logical route set — nine routes covering all eleven PRD segment types, four
boundaries, and five collision cases — in each candidate convention, and measures what
differs.

## Decision drivers

1. **Collision detectability.** Every expressible collision must be reported with all
   conflicting files named (`AC-ROUTE-02`). A convention that silently overwrites one
   route with another is disqualified.
2. **Aliasing surface.** The number of distinct legal paths that spell one URL. Each
   extra spelling is a place where two authors can disagree and a place a scanner can
   double-count.
3. **Reserved-name budget.** The PRD goal is "expressive without creating excessive
   special names."
4. **Precedence purity.** Precedence must be computable from the pattern, never from
   `readdir` order.
5. **Cross-platform safety.** Case folding, Unicode normalisation, and reserved device
   names must not silently change which route a file defines.
6. **Static analyzability without execution.** Route identity must be recoverable at
   build time without running application code (`docs/06_COMPILER_AND_DEV_SERVER.md`).
7. **Discoverability for a reader.** A newcomer should be able to find the module that
   serves a URL, and vice versa, without running a tool.

## Options

The spike measured all three. Numbers below are from
`spikes/route-convention/results/route-convention-comparison.md`, generated on Node
v24.16.0 / `win32` with TypeScript 5.9.3.

### Option A — role in the filename suffix (`about.page.tsx`, `_layout.tsx`)

The convention proposed in the routing PRD. Directories mirror URL segments; the file
name carries the role via a `.page` / `.endpoint` suffix; boundaries use an `_`
prefix; `(group)` directories are URL-transparent.

Measured: 11 reserved names. **Two legal spellings per URL** (`blog/post.page.tsx` and
`blog/post/index.page.tsx`), giving 17 paths for 9 routes. All 5 collision cases are
expressible and all 5 are detected with every conflicting file named. 0 precedence
ties.

Benefits: the role is visible in a file listing and in an editor tab title, which is
the strongest discoverability result of the three. Endpoints and pages can sit
side-by-side in one directory without an extra folder level. It matches the PRD's own
example tree, so no PRD text needs rewriting.

Disadvantages: the two-spellings-per-URL result is a real cost — `index.page.tsx` and
`name.page.tsx` are genuinely interchangeable, so the scanner must canonicalise before
comparing, and authors will mix both styles in one project. The reserved-name budget is
the largest measured.

### Option B — role in a fixed filename inside a route folder (`about/page.tsx`)

Directories mirror URL segments including the last one; a fixed `page.tsx` /
`endpoint.ts` / `layout.tsx` file inside carries the role.

Measured: 10 reserved names. **Exactly one spelling per URL**, 9 paths for 9 routes. 4
of the 5 collision cases are expressible and all 4 are detected with every conflicting
file named; the fifth (`duplicate-static`) is *unexpressible* — the convention gives
both routes the same path, so the second file simply overwrites the first on disk. 0
precedence ties.

Benefits: no aliasing at all, which is the cleanest structural result. One canonical
path per URL means the scanner needs no canonicalisation step.

Disadvantages, and the decisive one: **every route module is named `page.tsx`.** A
project with 200 routes has 200 identically-named files. That is a daily,
non-theoretical cost in editor tab strips, fuzzy-finders, stack traces, error messages,
and code review diffs. The "unexpressible collision" result also cuts the wrong way in
practice: the collision does not go away, it becomes invisible, because the filesystem
resolves it by overwrite rather than the toolchain resolving it by diagnostic. It also
forces a directory for every leaf route, which deepens the tree.

### Option C — explicit route manifest, no filesystem meaning

A single checked-in module maps URL patterns to route modules. Filenames carry no
routing meaning.

Measured: 1 reserved name (`routes.config.ts`). One spelling per URL. **No group
aliasing.** All 5 collision cases expressible and detected. Precedence comes from
declaration order in the manifest.

Benefits: the smallest reserved-name budget and no filesystem-derived semantics at
all, which sidesteps the entire cross-platform hazard class. Route identity is a
literal in one reviewable file.

Disadvantages: precedence by declaration order is the *opposite* of the PRD's
requirement that precedence be computed rather than positional — it replaces
`readdir` order with editor order, which is no more principled. Every route addition
edits a shared file, so it becomes a merge-conflict funnel and a review bottleneck in
proportion to team size. It also discards the PRD's stated intent, "Filesystem
conventions should be expressive", and `FR-002`'s framing, "Compile filesystem routes
into a typed manifest" — the manifest is meant to be *derived*, not authored.

## Decision

**Option A is the route filesystem convention**, with three amendments that close the
gaps the measurements exposed.

Reasons:

1. Option A and Option C both detect every expressible collision and neither has a
   precedence tie, so collision safety does not separate them. Option B is separated
   *against*, because its single unexpressible case resolves by silent overwrite. An
   invisible route loss is worse than a reported conflict.
2. Discoverability is the axis with the largest measured spread, and it is the axis the
   PRD names as a goal. Option A puts role and URL in the filename; Option B produces
   N identical filenames; Option C decouples filename from URL entirely.
3. Option C's precedence source is declaration order. The routing PRD's rule against
   enumeration order deciding precedence exists because positional authority is
   fragile, and manifest position is positional authority. Rejecting `readdir` order
   while accepting editor order would be inconsistent.
4. `FR-002` and `FR-011` describe a manifest that is *emitted*, and
   `docs/02_ARCHITECTURE.md` lists `route-manifest.json` as a build artifact. Option C
   would make the manifest a hand-authored input, which is a different architecture
   than the one already accepted.
5. Option A's real cost, two spellings per URL, is bounded and fixable inside the
   convention. Option B's cost is not: it is inherent to the naming scheme.

Three binding amendments, each answering a specific measurement:

- **A1 — one canonical spelling.** `dir/name.page.tsx` and `dir/name/index.page.tsx`
  both denote the same URL, so FW-105 must canonicalise before comparing and must
  report the pair as a collision when both exist. `index.page.tsx` is retained only for
  a directory's own URL where no other spelling exists; the flat form is canonical
  everywhere else. This converts Option A's aliasing surface from a hazard into a
  detected conflict.
- **A2 — case-insensitive and normalisation-insensitive collision comparison.** The
  spike measured, on `win32`: case-insensitive path resolution `true`, and Unicode
  NFC/NFD folded to one entry `false`. Since case folding and normalisation folding
  differ per platform, FW-104 and FW-105 must compare route keys after both
  case-folding *and* Unicode NFC normalisation, and must report a collision when two
  files differ only by case or only by normalisation form. A route tree that builds on
  Linux and silently loses a route on Windows is not acceptable under `NFR-009`.
- **A3 — reserved-name rejection at scan time.** The spike found that Windows reserved
  device names (`con`, `nul`, `aux`, `prn`, `com1`) are all creatable as
  `con.page.tsx`, as bare segments, and as route folders under the tested
  configuration. That is a portability trap rather than a present-day vulnerability, so
  FW-104 must reject route segments whose base name case-insensitively matches a
  Windows reserved device name, with a stable diagnostic and a remediation, instead of
  emitting a route that may behave differently on another developer's machine.

The eleven segment types in `docs/03_ROUTING_AND_NAVIGATION.md` are adopted unchanged.
`(group)` directories remain URL-transparent; the spike confirmed a group can hide an
otherwise-obvious duplicate (`group-transparency`), and that case is detected because
comparison happens on the erased URL pattern, not on the path.

## Consequences

Positive: the PRD's example tree becomes normative, so no routing documentation is
invalidated. Role and URL are both readable from a filename. Precedence is a pure
function of the pattern, verified across the whole fixture with zero ties. Collision
detection names every conflicting file.

Negative and honest: 11 reserved names is the largest budget of the three options, and
every one of them is a name an application author cannot use freely. Amendment A1 means
the scanner carries a canonicalisation step that Option B would not have needed, and
that step is a place bugs can hide — FW-105 must test it directly rather than trusting
it. Amendment A2 means route keys are compared in a folded form, so two files that look
different in a file explorer can be reported as conflicting; the diagnostic must
explain *why* to avoid appearing arbitrary.

What becomes harder: adding a twelfth segment type. The reserved-name budget is already
the stated weak point of this option, so any future addition must justify itself against
the PRD's "excessive special names" goal rather than being waved through.

What is deliberately not decided here: how a route module declares its configuration.
That is ADR-004. Route match-time performance is also out of scope; it belongs to
FW-106 and the `AC-ROUTE-06` 10 000-route fixture.

## Security analysis

Trust boundary affected: the mapping from an attacker-controlled URL to a
framework-selected module, and the build-time enumeration of the route directory. The
URL is attacker-controlled; the route tree is developer-controlled but its *shape* is
influenced by anything that can write into the project.

- **`SEC-INPUT-004` (no filesystem access from untrusted URL paths).** This is the
  requirement most endangered by a filesystem-shaped convention, precisely because the
  URL and the path resemble each other. This ADR makes the rule structural rather than
  advisory: the route tree is enumerated at build time into a fixed manifest, and
  request-time matching resolves against manifest entries only. No request-time code
  path may take a URL segment and join it to a directory. FW-104 owns root
  containment and symlink resolution; FW-119 owns the evidence. Not discharged here.
- **`SEC-INPUT-003` (identical URL normalisation across adapters).** Amendment A2
  fixes the *build-side* half of the normalisation question: route keys are folded to
  NFC and case-folded before comparison, so the manifest cannot depend on the
  developer's filesystem. The request-side half — how an incoming URL is normalised
  before matching — is FW-106 and FW-118. This ADR does not claim it.
- **`SEC-INPUT-005` (no catastrophic backtracking; explicit complexity limits).**
  Choosing a segment-based convention rather than author-supplied regular expressions
  is what makes this tractable: every segment type in this convention compiles to a
  bounded per-segment matcher, so there is no author-controlled regex to backtrack.
  Depth and segment-count limits are FW-106's responsibility. The spike measured 0
  precedence ties, which is a prerequisite for a deterministic matcher but is not
  itself a backtracking result.
- **`SEC-FILE-003` (static asset traversal, MIME, sniffing, execution).** Unaffected by
  this decision: the route convention governs the route directory, not the static asset
  root. Naming them separately is deliberate so that a future change here does not
  quietly widen the asset surface.
- **`SEC-INPUT-001` (all route parameters are untrusted).** Reinforced by amendment
  scope: this ADR chooses only how a route is *spelled*. Nothing about `[slug]`
  appearing in a filename implies that `params.slug` is validated. ADR-004 and FW-108
  must keep typed parameters from implying runtime validation.

Abuse cases considered:

- *Route shadowing by case or normalisation.* An attacker who can land a file in the
  route directory — through a dependency's postinstall, a generator, or a merged pull
  request — could add `Admin.page.tsx` next to `admin.page.tsx` and have it win or lose
  depending on the developer's platform. Amendment A2 makes this a build failure rather
  than a platform-dependent outcome. Note this is a build-time integrity concern, so
  `SEC-SUPPLY-005`'s install-script denial (already enforced through
  `pnpm-workspace.yaml`) is part of the control, not routing alone.
- *Precedence manipulation through enumeration order.* Rejected by construction:
  precedence is computed from the pattern and verified tie-free across the fixture.
- *Reserved device names as a denial vector.* Amendment A3 rejects them at scan time
  rather than discovering them when a colleague on Windows cannot check out the
  repository.

Residual risk: the cross-platform evidence in this ADR was produced on `win32` only.
Case-insensitivity on macOS's default configuration and NFD normalisation on macOS are
strongly expected but **not measured here**, and this ADR does not assert them. The
harness must be re-run on macOS and Linux — CI already runs all three platforms
(`.github/workflows/ci.yml`) — and amendment A2 is written to be safe under the union
of platform behaviours rather than to depend on any one of them. Until that
cross-platform run exists, A2's justification rests on one measured platform plus a
conservative rule; the rule is strictly safer than the alternative, so the gap affects
confidence in the rationale, not the safety of the outcome.

## Verification

- `spikes/route-convention/results/route-convention-comparison.md` and
  `.../route-convention-comparison.json` — generated evidence: 9 logical routes, 4
  boundaries, 5 collision cases, 3 conventions, Node v24.16.0, `win32`, TypeScript
  5.9.3.
- Collision detection is enforced, not observed: the harness exits non-zero if any
  expressible collision case goes unreported or fails to name every conflicting file.
- Aliasing measured, not assumed: 17 paths for 9 routes under Option A, 9 under Options
  B and C.
- Precedence measured: 0 tied overlapping pairs for all three conventions on this
  fixture.
- Cross-platform behaviour probed against a real temporary directory: 26 candidate
  paths created, 0 rejected, case-insensitive resolution `true`, NFC/NFD folding
  `false`, 5 reserved device names creatable in all three positions tested.
- `tests/route-convention.test.ts` asserts that this ADR exists, is `Accepted`, states
  a security impact, presents at least three options, names its amendments, and cites
  only `SEC-*`, `FW-*`, and `AC-ROUTE-*` identifiers that exist in the requirement
  documents.

What is **not** verified: no route scanner, parser, or matcher exists yet. This ADR
authorises FW-104 and FW-105 to be written against this convention; it does not claim
any of it is implemented. `AC-ROUTE-01` through `AC-ROUTE-07` remain open and are owned
by M1 tasks.

## Rollback or supersede plan

The assumption most likely to fail is that amendment A1's canonicalisation is worth its
complexity — that authors actually use both spellings and value the choice. If FW-104
and FW-105 find the canonicalisation step is a recurring bug source, or if application
authors report the two spellings as confusing rather than convenient, the cheaper
correction is to *narrow* Option A rather than to adopt Option B: forbid
`index.page.tsx` outside a directory's own URL, leaving exactly one spelling per URL
and keeping every discoverability advantage.

A full supersede to Option B remains possible and is mechanical in one direction:
`dir/name.page.tsx` becomes `dir/name/page.tsx` by a codemod, because Option A's
canonical form maps injectively onto Option B's. The reverse is not true once two
Option A spellings coexist, which is a second reason A1 forbids that state.

The trigger for reopening this ADR is any of: a measured collision case that this
convention cannot report; a platform in the supported matrix where A2's folded
comparison produces a false conflict on realistic route names; or `AC-ROUTE-06` failing
for a reason traceable to the convention rather than to the matcher implementation. Any
supersede must re-run `spikes/route-convention/measure.mjs` on all three supported
platforms first, so the replacement decision is better evidenced than this one.
