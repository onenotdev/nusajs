# Runtime Adapters, Deployment, and Plugin System PRD

## Deployment adapter contract

A deployment adapter turns framework output into deployable artifacts and, where applicable, connects the framework server runtime to a host runtime. Server-host adapters and the static-output adapter are subtypes. An adapter may not redefine routing, cache behavior, error behavior, or security requirements. The final public interface name requires an accepted ADR.

```ts
interface RuntimeAdapter {
  name: string;
  capabilities: CapabilityMap;
  configure?(context: AdapterConfigureContext): void | Promise<void>;
  build(context: AdapterBuildContext): Promise<AdapterBuildResult>;
  preview?(context: AdapterPreviewContext): Promise<PreviewServer>;
}
```

## Official adapter expectations

### Node.js

- Standalone server output.
- Streaming and abort propagation.
- Graceful shutdown.
- Explicit trust-proxy configuration.
- Request, header, and body limits.
- Safe handling of malformed HTTP input delegated to a maintained server implementation.

### Static

- HTML and asset output.
- Dynamic parameter enumeration.
- Redirect/rewrite manifest when supported by the host.
- Explicit fallback behavior.
- Build failure for routes that require a server and lack a fallback.

### Bun and Deno

Introduced only after Node conformance is stable. Universal packages do not change to accommodate them.

### Edge runtimes

- No Node polyfill requirement.
- Direct Web-Standard semantics.
- Declared CPU, memory, subrequest, body, and streaming limitations.
- Cryptographic needs use audited platform APIs.

## Environment variables and secrets

- Server secrets may not enter the client graph.
- Public environment values require explicit declaration and schema validation. A naming prefix may assist declaration but is not sufficient by itself, and every exposed value is visible by name in the security manifest.
- Environment schemas validate at build or startup according to mode.
- Errors display variable names only, never values.
- Adapter-generated config and logs must preserve redaction.

## Preview fidelity

`framework preview` runs production artifacts. If host behavior cannot be emulated, the CLI reports each semantic difference.

## Adapter conformance

The same black-box suite verifies URL and method handling, headers, cookies, body and streaming, cancellation, routing, errors, assets, supported cache behavior, environment isolation, security controls, and cleanup.

## Plugin goals

Plugins extend configuration schemas, virtual modules, isolated compiler transforms, routes, middleware, asset handlers, devtools panels, deployment metadata, or runtime capabilities without private imports.

Plugins may not silently:

- Read every environment secret.
- send telemetry;
- weaken a route security or cache policy;
- inject a global client runtime;
- write outside declared output and cache directories;
- modify another plugin’s files or manifests;
- disable security diagnostics.

## Plugin trust model

npm plugins execute trusted code during build and sometimes at runtime. Metadata or future permissions improve visibility but do not create a sandbox. Documentation must state this clearly.

## Plugin lifecycle

Proposed phases include configuration setup, route discovery, route resolution, transform, build start, manifest, build completion, development server, runtime request, and runtime response. Final names and contracts require an RFC.

Plugin ordering is explicit. Dependencies declare version ranges. Conflicts in routes, virtual modules, or output files fail with the responsible plugin names.

## Acceptance criteria

- AC-ADAPT-01: One fixture behaves consistently across Node and static adapters for supported capabilities.
- AC-ADAPT-02: Static builds list every unsupported server route.
- AC-ADAPT-03: Secrets never appear in public manifests or client chunks.
- AC-ADAPT-04: Preview uses production artifacts.
- AC-ADAPT-05: Third-party adapters can run conformance tests without internal imports.
- AC-PLUGIN-01: A sample plugin adds a route, virtual module, diagnostic, and devtools panel through public APIs.
- AC-PLUGIN-02: Plugin failures identify plugin and lifecycle phase.
- AC-PLUGIN-03: Client injection appears in the bundle inspector.
- AC-PLUGIN-04: Plugin compatibility ranges are enforced.
- AC-PLUGIN-05: A malicious-plugin fixture demonstrates and documents the trusted-code boundary.

