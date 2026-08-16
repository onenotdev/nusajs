# Testing, Compatibility, and Quality PRD

## Test layers

### Unit tests

Route parsing, matching, URL normalization, serialization, cache keys, header merging, redaction, errors, configuration, and utilities.

### Type tests

Parameter and data inference, actions, server functions, invalid usage, public exports, and compatibility snapshots.

### Integration tests

Compiler and bundler integration, manifests, SSR, static generation, HMR, plugins, adapters, and production artifacts.

### Browser end-to-end tests

Navigation, focus and scroll, forms without JavaScript, hydration, islands, streaming, recovery, CSP, CSRF, cookies, and accessibility.

### Conformance tests

Black-box suites for adapters and renderers. Third parties can consume them without private framework source.

### Property and fuzz tests

Route patterns, URL normalization, serialization, headers, cookies, cache keys, manifests, and parser limits.

### Security tests

The full categories in `09_SECURITY_PRD.md`, including XSS, traversal, CSRF, Host/proxy, cache isolation, SSRF integrations, secret boundaries, dev tooling, and supply chain.

## Platform matrix

- Development OS: current supported Ubuntu, Windows, and macOS.
- Runtime: documented Node LTS lines; Bun and Deno according to adapter maturity.
- Package managers: pnpm primary, npm compatibility, modern Yarn smoke.
- Browsers: supported stable Chromium, Firefox, and WebKit policy finalized before v1.
- TypeScript: documented supported range plus informational canary testing.

## Pull-request gates

1. Formatting and lint.
2. Type checking and public type surface.
3. Unit and type tests.
4. Affected integration tests.
5. Example compilation.
6. Node/static conformance.
7. Security tests required by changed trust boundaries.
8. Dependency, secret, and license scans.
9. Bundle budget and benchmark smoke.
10. Documentation links and executable examples.

Nightly runs the full browser matrix, extended fuzzing, all adapters, extended benchmarks, dependency review, and canary toolchains.

## Flaky-test policy

- Retries collect evidence; they do not turn a failing gate green.
- Every flaky test has an issue, owner, and deadline.
- P0 correctness or security tests cannot be quarantined.
- Quarantines remain visible in dashboards and release reviews.

## Compatibility

- Stable packages use semantic versioning.
- Core packages use coordinated versions through initial ecosystem maturity.
- Experimental APIs use an explicit import path or marker.
- After v1, deprecations remain for at least one appropriate minor cycle unless a security fix requires faster removal.
- Manifest schemas version independently.

## Release quality levels

- Alpha: APIs may change; core journeys work.
- Beta: target milestone is feature complete; migration is documented.
- Release candidate: only blockers are fixed; conformance and security review are complete.
- Stable: compatibility and vulnerability-management policies apply.

## Acceptance criteria

- AC-QA-01: Required gates prevent merge when failing.
- AC-QA-02: Every regression fix includes a regression test.
- AC-QA-03: Public type surfaces are compared automatically.
- AC-QA-04: Third parties can consume conformance packages.
- AC-QA-05: Release artifacts include supported provenance/signing evidence.
- AC-QA-06: No P0 security test may be skipped or quarantined for release.

