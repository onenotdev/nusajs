# Renderer evaluation spike (FW-003 / ADR-002)

This directory is a **throwaway measurement spike**. It exists only to produce
reproducible evidence for the renderer decision recorded in
`docs/adr/ADR-002-first-official-renderer.md`.

Rules that apply to this directory:

- It is not a framework package. It lives outside `packages/*` and is `private`.
- Nothing here is a public API, and nothing here may be imported by framework code.
- It may be deleted once ADR-002 is superseded or the renderer contract (FW-111)
  ships with real conformance tests.

## What it measures

The same JSX component tree (`fixtures/app.jsx`) is compiled once per candidate by
esbuild, changing only the JSX import source and the hooks module alias. Three
candidates are measured: `react` + `react-dom`, `preact` +
`preact-render-to-string`, and the React-shaped API on the small runtime
(`preact/compat`). The third exists to test whether the choice is really
React-versus-not-React. For each candidate the spike measures:

| Axis | Method |
| --- | --- |
| SSR throughput | 20 warm-up renders, then 200 timed `renderToString` calls in a child process |
| SSR output size | Byte length of the produced HTML for the interactive and static variants |
| Client bundle size | Minified, production-defined, browser-target ESM hydration bundle; raw, gzip, and Brotli bytes |
| Hydration | Bundle is hydrated over the real SSR markup inside `happy-dom`, then a click must change the counter text |
| Zero-JS static page | Static variant renders with no client entry; asserts the HTML contains no `<script` and that 0 client bytes are emitted |
| Default escaping | A hostile string is rendered in text, attribute, and URL position; asserts no `script` or `img` element is created (`SEC-XSS-001`, `SEC-XSS-003`) |
| License and maintenance | Resolved version and `license` field of every runtime package that reaches the output |

The hydration, zero-JS, and escaping checks are enforced, not merely reported:
the harness exits non-zero if any candidate fails them.

DX is not machine-measurable. The spike instead makes the DX difference
*visible*: the shared fixture proves how much source is portable between the
candidates, and the per-candidate entry files show exactly which imports differ.
That difference is what ADR-002 reasons about.

## Run it

```powershell
pnpm install
pnpm --filter @nusajs-spike/renderer-evaluation run measure
```

Results are written to `results/renderer-comparison.json` and
`results/renderer-comparison.md`. Both are committed as ADR evidence. `dist/` is
generated and git-ignored.

Bundle sizes are deterministic and reproduce byte-for-byte. SSR throughput is
not: repeated runs on one machine moved the react-to-preact ratio across roughly
1.2x to 2.1x. **No SSR throughput claim from this spike may be published.** A
defensible throughput number requires the FW-007 benchmark harness. ADR-002
deliberately rests on bundle size, module format, dependency count, and escaping.
