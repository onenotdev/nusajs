# NusaJS

NusaJS is an early-stage, full-stack TypeScript and JavaScript web framework. It is designed for
general-purpose applications, including static sites, content platforms, dashboards, SaaS products,
APIs, real-time applications, and larger production systems.

The project focuses on:

- Web Standards across universal runtime code;
- end-to-end TypeScript support;
- explicit rendering, caching, and side effects;
- portable runtime and deployment boundaries;
- secure defaults and actionable diagnostics;
- measurable performance backed by reproducible benchmarks.

## Project status

NusaJS is under active development and is not ready for production use. Package APIs, installation
instructions, compatibility guarantees, and release channels will be documented when the first
usable framework packages are available.

## Requirements

- Node.js 22.12.0 or newer
- pnpm 11.5.1

## Development

Install dependencies and run the repository checks:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run verify
```

Run the benchmark harness fixture list with `pnpm run benchmark:list`. Benchmark results are only
publishable when their correctness and security prerequisites pass.

## Packages

Publishable framework packages will live under `packages/`. The project currently contains the
workspace and research infrastructure needed to establish the first stable package boundaries.

## License

Licensed under the MIT License.

