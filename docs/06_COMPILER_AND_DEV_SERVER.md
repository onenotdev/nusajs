# Compiler, Build Pipeline, CLI, and Development Server PRD

## Objectives

The compiler must be incremental, deterministic, inspectable, and secure against untrusted project input. Vite is the initial build foundation, but runtime APIs must not expose bundler internals.

## Build pipeline

1. Load and validate configuration.
2. Discover routes and plugins.
3. Build route, module, capability, and trust-boundary graphs.
4. Analyze supported static exports.
5. Generate typed routes and virtual modules.
6. Transform server, client, and island boundaries.
7. Build target chunks.
8. Emit versioned manifests and diagnostics.
9. Run adapter finalization.
10. Emit a security summary and reproducibility metadata.

## Configuration

```ts
export default defineConfig({
  adapter: node(),
  renderer: react(),
  output: "server",
  plugins: [],
  security: { mode: "strict" }
});
```

Schema errors include the exact property path, expected type, received value description, remediation, and documentation. Secret values are never printed.

## Static analysis

The compiler must not execute complete application modules merely to read route configuration. It should use analyzable exports or isolated evaluation with an explicit capability boundary. Dynamic configuration reduces optimization and produces a visible diagnostic.

## Development server security

- Serve files only from explicitly allowed roots.
- Deny parent traversal and unsafe symlink escape.
- Bind to loopback by default.
- Require an explicit flag to expose the server to a network.
- Validate Host and WebSocket upgrade origins.
- Protect development RPC and inspector endpoints with unguessable session tokens when network-exposed.
- Never render arbitrary filesystem files based on URL input.
- Do not expose environment secrets in overlays or serialized diagnostics.
- Apply request, message, and payload size limits.

## HMR

- Component changes preserve state only when the renderer declares it safe.
- Loader/action changes invalidate related route data.
- Route-tree changes update manifests without restart when possible.
- Configuration or adapter changes trigger a controlled restart with a visible reason.
- HMR failure falls back to full reload without duplicate server state.
- HMR transport validates origin and session identity.

## Diagnostics model

```ts
interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  file?: string;
  range?: SourceRange;
  hint?: string;
  docs?: string;
}
```

Terminal output, browser overlays, JSON CI output, and devtools consume the same structured diagnostic. Production diagnostics are redacted.

## Reproducibility

- Absolute paths do not affect hashes or user-facing output.
- Filesystem enumeration is normalized.
- Manifests are sorted deterministically.
- Timestamps are excluded unless explicitly requested.
- Output-affecting environment names are recorded without values.
- Plugin order and versions are recorded.

## CLI commands

```text
framework create
framework dev
framework build
framework preview
framework typecheck
framework inspect
framework security
```

Commands support `--help`, consistent exit codes, color control, and machine-readable output where appropriate. The `security` command reports unsafe configuration, dependency findings, client-secret leaks, public-cache risks, and manifest warnings; it is not a replacement for an independent audit.

## Acceptance criteria

- AC-COMP-01: Two builds with identical inputs and toolchains produce identical artifact hashes.
- AC-COMP-02: A small route edit does not rebuild the entire application.
- AC-COMP-03: Configuration diagnostics identify exact property paths without secret values.
- AC-COMP-04: HMR recovers after syntax errors without a manual process restart.
- AC-COMP-05: Generated types remain unchanged when the route graph is unchanged.
- AC-COMP-06: CLI smoke tests pass on Windows, macOS, and Linux.
- AC-COMP-07: Development-server traversal, host-header, origin, and symlink security suites pass.

