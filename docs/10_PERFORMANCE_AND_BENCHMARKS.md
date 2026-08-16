# Performance Budgets and Benchmark PRD

## Principle

No “faster” claim is allowed without a public, reproducible, feature-equivalent benchmark. Results must separate cold and warm states, development and production, static and server rendering, and local and edge environments.

## Initial budgets

| Metric | v0.1 budget | Mature target |
|---|---:|---:|
| Framework JS on static page | exactly 0 emitted and transferred bytes | exactly 0 emitted and transferred bytes |
| Minimal hydrated page JS, gzip | <= 45 KB | <= 30 KB |
| Dev cold start on reference machine | <= 1.5 s | <= 500 ms |
| Component HMR median | <= 250 ms | <= 100 ms |
| Minimal production build | <= 10 s | <= 5 s |
| Node cold import/start | <= 250 ms | <= 100 ms |
| Router p95 match, 10k routes | <= 1 ms | <= 0.5 ms |

Budgets require calibration after prototypes. Correctness and security always take priority over speed.

## Benchmark fixtures

- B01 Hello static: one non-interactive page.
- B02 Static-1000: one thousand content pages.
- B03 Minimal SSR.
- B04 Data SSR: loader with controlled simulated latency and abort.
- B05 Ten islands with small interactions.
- B06 Dashboard: nested layouts, policy middleware, representative chart bundle.
- B07 API: small JSON, large JSON, and streaming.
- B08 Routes-10k: static, dynamic, and catch-all mix.
- B09 Monorepo: twenty packages and shared UI.
- B10 Rebuild: component, loader, route tree, and configuration edits.
- B11 Security overhead: strict security defaults versus explicitly relaxable controls disabled through documented unsafe overrides, without disabling P0 or invariant protections and without using the disabled result for marketing or deployable guidance.

## Comparison frameworks

Compare current pinned versions of Next.js, Nuxt, Astro, SvelteKit, and React Router Framework Mode. Only compare equivalent capabilities: static with static, SSR with SSR, equal content and client behavior, and comparable security settings.

## Methodology

- Record hardware, OS, runtime, framework, dependency, and configuration versions.
- Control CPU policy and background workload where practical.
- Define cache cleaning for cold runs and warm-up for warm runs.
- Use at least 30 samples for short latency measurements.
- Report median, p95, p99, minimum, maximum, and standard deviation.
- Store raw JSON/CSV as CI artifacts.
- Do not remove outliers without a predeclared rule.
- Complete a correctness and security prerequisite before collecting performance results.

## Bundle reporting

Report raw, gzip, and Brotli sizes for first-load JavaScript, CSS, route chunks, shared runtime, and hydration data. Source maps are excluded from transfer-size claims but tracked separately. Show the largest contributing dependencies.

## Regression gates

- More than 5% on a stable metric: warning and review.
- More than 10%: block merge unless an accepted regression ADR exists.
- More than 2 KB gzip growth on the minimal fixture: block or justify.
- Any optimization that bypasses a security requirement is rejected.

## Acceptance criteria

- AC-PERF-01: All benchmarks run through one documented command.
- AC-PERF-02: Raw data and environment metadata are retained.
- AC-PERF-03: The static fixture proves zero JS through manifests and browser network capture.
- AC-PERF-04: Comparison versions and configuration are pinned.
- AC-PERF-05: CI detects regressions against an approved baseline.
- AC-PERF-06: Every benchmark result records correctness and security prerequisite status.

