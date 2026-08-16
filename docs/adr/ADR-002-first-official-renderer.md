# ADR-002: First official renderer

- Status: Accepted
- Date: 2026-08-15
- Owner: Lead founding engineer (agent: GitHub Copilot, `gpt-pro`)
- Related tasks: FW-003, FW-111 (renderer contract), FW-112 (minimal SSR renderer)
- Security impact: medium

## Context

`docs/00_MASTER_PRD.md` §15 lists the first official renderer as an open decision
and offers two options: a React-compatible renderer or a smaller independent
renderer. `docs/02_ARCHITECTURE.md` requires the renderer to sit behind a public
contract so that core never depends on it. `docs/13_POSITIONING_RISKS_AND_DECISIONS.md`
records R-02, "Custom renderer is built too early", as a High/High risk whose
mitigation is a renderer contract plus an evidence-based spike.

Two product acceptance criteria constrain the choice directly:

- AC-PROD-04: a non-interactive static page ships 0 bytes of framework JavaScript.
- AC-RENDER-01 and the island model in `docs/04_RENDERING_AND_HYDRATION.md`: only
  islands hydrate, so the hydration payload is a first-order product metric.

NFR-006 additionally requires production dependencies to be minimized and audited.

The decision is required now because FW-111 (renderer contract) and FW-112
(minimal SSR renderer) both depend on it, and because writing a custom renderer
without evidence is precisely the R-02 failure mode.

FW-003 therefore built a throwaway measurement spike at
`spikes/renderer-evaluation/` rather than reasoning from reputation. Full evidence:
`spikes/renderer-evaluation/results/renderer-comparison.md` and `.json`.

## Decision drivers

- Hydration payload size, because the island model makes it the dominant
  client-side cost (AC-PROD-04, AC-RENDER-01).
- Runtime dependency count and audit surface (NFR-006, `SEC-SUPPLY-001`).
- Default-escaping behavior in text, attribute, and URL position
  (`SEC-XSS-001`, `SEC-XSS-003`).
- Module format of the server renderer, because universal packages must use Web
  Standards and must not import Node built-ins (NFR-001).
- Portability of application source, so that a later renderer swap does not
  invalidate user code.
- Ecosystem access, because rejecting the React component ecosystem outright is a
  real product cost, not a neutral simplification.
- Avoiding a custom renderer entirely at this stage (R-02).

## Options

### Option A — React-compatible (`react` + `react-dom`)

Largest component ecosystem and the most familiar authoring model. Measured:
60 891 B gzip / 52 331 B brotli hydration payload; a three-package runtime graph
(`react`, `react-dom`, and the transitive `scheduler`); a 557 101 B server
bundle. `react-dom/server` is CommonJS and dynamically requires Node built-ins:
bundling it to ESM failed with `Dynamic require of "util" is not supported` until
the spike injected a `createRequire(import.meta.url)` banner. Escaping was
correct, including `>`. Release cadence is very high (465 published versions in
the last 12 months, including canary and experimental channels) with 2 npm
maintainers. MIT.

### Option B — Small independent (`preact` + `preact-render-to-string`)

Measured: 5 960 B gzip / 5 389 B brotli hydration payload; a two-package runtime
graph; a 31 559 B server bundle. The server renderer is ESM-native and required
no interop shim. Escaping was correct in text, attribute, and URL position;
it does not additionally encode `>`, which is a cosmetic difference rather than a
security one once `<` and `"` are encoded. Release cadence is moderate (22
versions in 12 months) with 6 npm maintainers. MIT. The cost is loss of direct
React ecosystem compatibility.

### Option C — React API on the small runtime (`preact/compat`)

Added to the spike specifically to test whether the PRD's either/or framing is
real. It is not. The same fixture, authored against the React API surface
(`hydrateRoot`), runs on the small runtime and hydrates correctly. Measured:
8 109 B gzip / 7 366 B brotli — 1.36x Option B, and still 7.5x smaller than
Option A. Same two-package runtime graph, same license, same escaping behavior.

### Option D — Custom renderer

Rejected without measurement. This is the R-02 failure mode: it front-loads the
hardest correctness surface in the product (hydration, streaming, serialization)
before the contract that would constrain it exists.

## Decision

**Option B is the first official renderer**: the small independent renderer
(`preact` + `preact-render-to-string`).

Concrete reasons:

1. The hydration payload is roughly 10x smaller than Option A (5 960 B versus
   60 891 B gzip). Under the island model this is the metric the product is
   built around, and no other measured axis moves in the opposite direction.
2. Its server renderer is ESM-native. Option A needed a `createRequire` banner
   to bundle at all, which is direct evidence of friction against NFR-001 and
   against the Web-Standard runtime story that adapters depend on.
3. Two runtime packages instead of three, which is a smaller audit surface
   (NFR-006).
4. It is an existing, maintained, MIT-licensed renderer, so R-02 is avoided: no
   custom renderer is being written.
5. Option C demonstrates that React-shaped API compatibility is available on this
   same runtime at a bounded cost. Choosing Option B therefore does not
   permanently foreclose React-style authoring.

Three binding commitments accompany this decision:

- The renderer is reached only through the FW-111 public contract. Core, router,
  and server must not import the renderer directly. Choosing Option B is a
  choice of *first* implementation, not of architecture.
- A React-compatible renderer remains planned follow-on work, implemented as a
  second renderer behind the same contract. This ADR does not claim React
  support is unnecessary.
- Framework-generated markup must not rely on the renderer's escaping alone.
  `SEC-XSS-002` (serialized data embedded in HTML) is the framework's
  responsibility and is out of scope for a renderer choice.

## Consequences

Positive: the smallest measured hydration payload; an ESM-native server path; a
two-package runtime graph; no custom renderer; and a static path that ships 0
bytes of JavaScript, verified for all three candidates.

Negative and honest: React component libraries do not work unaltered. Teams
hiring for React experience will find the integration surface unfamiliar even
though the authoring surface is nearly identical. The chosen packages have fewer
npm maintainers in absolute terms than React, though more than React's two —
concentration risk exists on both sides. Option A's very high release cadence is
partly canary traffic and should not be read as a maintenance advantage.

What becomes harder: any future claim of "React compatibility" must be earned by
implementing the second renderer and passing renderer conformance
(`docs/11_TESTING_AND_QUALITY.md`), not asserted from `preact/compat` behaving
well in a spike.

## Security analysis

Trust boundary affected: server-rendered HTML, which is the primary XSS surface.

- `SEC-XSS-001` and `SEC-XSS-003`: verified by measurement. A hostile fixture
  string, `"><script>alert(1)</script><img src=x onerror=alert(2)>`, was rendered
  in text, attribute (`title`), and URL (`href`) position. All three candidates
  encoded `<` and `"` such that no `script` or `img` element was created. The
  spike fails the run if this invariant breaks, so the check is enforced rather
  than observed once. The renderer performs contextual escaping; it does not
  sanitize arbitrary HTML, and per `SEC-XSS-003` the framework must not claim it
  does.
- `SEC-XSS-002`, `SEC-XSS-004`, `SEC-XSS-005`, `SEC-XSS-006`: unaffected by this
  decision and not delegated to the renderer. Serialization safety, request-local
  CSP nonces, hydration payload validation, and mismatch diagnostics are
  framework responsibilities under FW-111/FW-112.
- `SEC-SUPPLY-001` and NFR-006: the selected runtime graph is two packages, both
  MIT, versus three for Option A. Licenses were resolved programmatically from
  installed `package.json` files, not from documentation.
- `SEC-SUPPLY-005`: the spike added six dev dependencies, all exact-pinned, all
  MIT-verified before adoption. No install script was granted; the workspace
  `allowBuilds: { esbuild: false }` denial from ADR-005 still holds even though
  esbuild is now a direct spike dependency.

Abuse case considered: a renderer that escapes by default but exposes an easily
reachable raw-HTML API invites injection. Both candidates gate raw HTML behind an
explicitly named unsafe prop, which satisfies `SEC-XSS-001`'s naming requirement.

Residual risk: the escaping evidence is a single-payload probe, not the XSS
polyglot corpus that `docs/09_SECURITY_PRD.md` requires for verification. That
corpus is owned by FW-112 and the renderer conformance suite. This ADR asserts
only that neither candidate is disqualified on default escaping.

## Verification

- `spikes/renderer-evaluation/results/renderer-comparison.md` — generated
  evidence: Node v24.16.0, win32-x64, esbuild 0.28.2, 200 timed SSR renders after
  20 warm-ups, per candidate.
- Hydration proven functionally, not assumed: the SSR markup is loaded into a DOM,
  the real client bundle is executed, a button is clicked, and the counter text is
  asserted to change (`Clicks: 0` -> `Clicks: 1`) for all three candidates.
- AC-PROD-04 proven for all three: 0 client bytes and no `<script` in the static
  page HTML. The harness throws if either invariant fails.
- Maintenance evidence, collected 2026-08-15 from the registry: `react` 465
  releases/12mo, 2 maintainers; `react-dom` 465 releases/12mo, 2 maintainers;
  `preact` 22 releases/12mo, 6 maintainers; `preact-render-to-string` 9
  releases/12mo, 6 maintainers.

Known limitation, stated rather than hidden: bundle sizes are deterministic and
reproduce byte-for-byte across runs, but SSR throughput on this machine was not
stable — the react-to-preact ratio moved across roughly 1.2x to 2.1x, and the
`compat` candidate's ratio moved more. **The decision rests on bundle size,
module format, dependency count, and escaping, all of which are stable. No SSR
throughput claim from this spike may be published.** A defensible throughput
number requires the FW-007 benchmark harness.

Also: the spike's `.mjs` and `.jsx` files are outside the root `tsconfig.json`
include list and are therefore not type-checked. Acceptable for throwaway
measurement code; it must not be true of FW-111 or FW-112.

## Rollback or supersede plan

The assumption that could fail is that the small runtime's ecosystem gap costs
more adoption than its ~10x payload advantage wins.

Rollback is bounded by the FW-111 contract. If the assumption fails, a
React-compatible renderer is added as a second implementation behind the same
contract; router, server, and core are unaffected because they never import a
renderer. The spike shows the application-source delta is narrow: the JSX import
source, the module re-exporting hooks, the server render call, and the client
hydrate call.

Supersede triggers:

- Renderer conformance cannot be satisfied by the chosen renderer.
- A required capability (streaming, selective hydration, async boundaries) proves
  unimplementable behind the contract.
- The FW-007 harness contradicts the size advantage measured here.

This ADR must be superseded, not silently amended, if the first official renderer
changes.
