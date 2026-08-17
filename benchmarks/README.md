# Benchmark Harness

FW-007 establishes the measurement harness baseline. It does **not** establish a framework
performance baseline: no framework packages or B01–B11 fixtures exist yet.

## Commands

Run the calibration fixture through the same command future fixtures use:

```text
pnpm run benchmark
```

List planned and implemented fixtures:

```text
pnpm run benchmark:list
```

The default command performs five untimed warm-up iterations, then retains all 30 timed samples in
`benchmarks/results/harness-calibration.json`. The results directory is ignored by Git; raw result
files belong in CI artifacts or an explicitly approved baseline change, not incidental commits.

Custom invocations may use `--fixture`, `--samples`, `--warmup`, and `--output`. Short latency runs
reject fewer than 30 samples. Fixture IDs are lowercase ASCII slugs and output must remain inside
the repository. The harness imports fixtures only from `benchmarks/fixtures/`; it does not execute an
arbitrary module path supplied by the caller.

## Result contract

Each result records:

- schema version, framework version, fixture, commit, generation time, and configuration hash;
- OS, architecture, CPU, logical CPU count, memory, and runtime;
- warm-up count, measured count, cache state, clock, and the predeclared no-outlier-removal policy;
- correctness and security prerequisite outcomes and the checks that produced them;
- every raw sample plus minimum, maximum, median, p95, p99, mean, and population standard deviation;
- a claim scope stating what the measurement may support.

A fixture's prerequisite function runs before warm-up or sampling. Anything other than explicit
`correctness: "pass"` and `security: "pass"` aborts the run and writes no result. A passing fixture
prerequisite proves only the checks named in that result; it does not discharge a `SEC-*`
requirement or prove that the framework is secure.

## Calibration versus framework evidence

`harness-calibration` measures deterministic in-process work so the runner, schema, statistics, and
prerequisite gate can be tested today. Its result explicitly says it is not framework performance
and may not be used for marketing. B01–B11 remain `planned` in `benchmarks/fixtures.json` until their
own implementation tasks create feature-equivalent fixtures and correctness/security suites.

No “faster” claim may cite calibration output. Framework or comparison claims additionally require
pinned versions and configurations, equivalent capabilities, approved baseline data, and the
browser or runtime evidence required by `docs/10_PERFORMANCE_AND_BENCHMARKS.md`.
