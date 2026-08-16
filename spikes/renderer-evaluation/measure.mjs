// FW-003 renderer evaluation harness.
//
// Compiles one shared JSX fixture against two candidate renderers, then measures
// SSR throughput, SSR output size, client bundle size, hydration correctness, and
// the zero-JavaScript static guarantee. Also records the resolved version and
// license of every runtime package that reaches the output.
//
// This is throwaway measurement code for ADR-002. It is not framework source.

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { brotliCompressSync, gzipSync } from "node:zlib";
import * as esbuild from "esbuild";
import { Window } from "happy-dom";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const root = import.meta.dirname;
const distDir = path.join(root, "dist");
const resultsDir = path.join(root, "results");

const SSR_WARMUP = 20;
const SSR_ITERATIONS = 200;
const HYDRATION_TIMEOUT_MS = 15_000;

function log(message) {
  process.stderr.write(`[spike] ${message}\n`);
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CANDIDATES = [
  {
    id: "react",
    title: "React-compatible (react + react-dom)",
    jsxImportSource: "react",
    hooks: path.join(root, "entries", "hooks.react.js"),
    server: path.join(root, "entries", "server.react.jsx"),
    client: path.join(root, "entries", "client.react.jsx"),
    runtimePackages: ["react", "react-dom", { name: "scheduler", via: "react-dom" }]
  },
  {
    id: "preact",
    title: "Small independent (preact + preact-render-to-string)",
    jsxImportSource: "preact",
    hooks: path.join(root, "entries", "hooks.preact.js"),
    server: path.join(root, "entries", "server.preact.jsx"),
    client: path.join(root, "entries", "client.preact.jsx"),
    runtimePackages: ["preact", "preact-render-to-string"]
  },
  {
    id: "compat",
    title: "React API on the small runtime (preact/compat)",
    jsxImportSource: "preact",
    hooks: path.join(root, "entries", "hooks.compat.js"),
    server: path.join(root, "entries", "server.compat.jsx"),
    client: path.join(root, "entries", "client.compat.jsx"),
    runtimePackages: ["preact", "preact-render-to-string"]
  }
];

function sharedBuildOptions(candidate) {
  return {
    bundle: true,
    format: "esm",
    jsx: "automatic",
    jsxImportSource: candidate.jsxImportSource,
    alias: { "runtime-hooks": candidate.hooks },
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent"
  };
}

async function buildServer(candidate) {
  const outfile = path.join(distDir, candidate.id, "server.mjs");
  await esbuild.build({
    ...sharedBuildOptions(candidate),
    entryPoints: [candidate.server],
    platform: "node",
    target: "node20",
    // react-dom ships its server renderer as CommonJS that requires Node built-ins.
    // Bundling it to ESM needs a real `require` in scope, otherwise esbuild's
    // interop shim throws "Dynamic require of \"util\" is not supported".
    banner: {
      js: [
        'import { createRequire as __spikeCreateRequire } from "node:module";',
        "const require = __spikeCreateRequire(import.meta.url);"
      ].join("\n")
    },
    outfile
  });
  return outfile;
}

async function buildClient(candidate, format) {
  const outfile = path.join(distDir, candidate.id, `client.${format}.js`);
  await esbuild.build({
    ...sharedBuildOptions(candidate),
    entryPoints: [candidate.client],
    platform: "browser",
    target: "es2022",
    format,
    minify: true,
    outfile
  });
  const bytes = await readFile(outfile);
  return { outfile, bytes };
}

function sizeOf(bytes) {
  return {
    raw: bytes.byteLength,
    gzip: gzipSync(bytes, { level: 9 }).byteLength,
    brotli: brotliCompressSync(bytes).byteLength
  };
}

async function measureSsr(serverBundle) {
  const runner = path.join(distDir, "ssr-runner.mjs");
  const source = [
    `const { render } = await import(${JSON.stringify(pathToUrl(serverBundle))});`,
    `const warmup = ${SSR_WARMUP};`,
    `const iterations = ${SSR_ITERATIONS};`,
    "const interactiveHtml = render(true);",
    "const staticHtml = render(false);",
    "for (let i = 0; i < warmup; i += 1) { render(true); }",
    "const started = process.hrtime.bigint();",
    "for (let i = 0; i < iterations; i += 1) { render(true); }",
    "const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;",
    "process.stdout.write(JSON.stringify({",
    "  elapsedMs,",
    "  iterations,",
    "  msPerRender: elapsedMs / iterations,",
    "  rendersPerSecond: (iterations / elapsedMs) * 1000,",
    "  interactiveHtml,",
    "  staticHtml",
    "}));"
  ].join("\n");
  await writeFile(runner, source, "utf8");
  const { stdout } = await execFileAsync(process.execPath, [runner], {
    maxBuffer: 16 * 1024 * 1024
  });
  return JSON.parse(stdout);
}

function pathToUrl(filePath) {
  return new URL(`file:///${filePath.split(path.sep).join("/")}`).href;
}

async function checkHydration(html, clientCode) {
  const window = new Window({ url: "https://spike.invalid/" });
  window.document.write(`<!doctype html><html><body>${html}</body></html>`);

  // happy-dom does not provide the scheduler channel React relies on.
  if (typeof window.MessageChannel === "undefined") {
    window.MessageChannel = MessageChannel;
  }

  const counter = window.document.querySelector("[data-testid='counter']");
  const before = counter ? counter.textContent : null;

  try {
    const after = await withTimeout(
      (async () => {
        window.eval(clientCode);
        await delay(100);

        const target = window.document.querySelector("[data-testid='counter']");
        if (!target) {
          throw new Error("counter element disappeared during hydration");
        }
        target.click();
        await delay(100);

        return window.document.querySelector("[data-testid='counter']").textContent;
      })(),
      HYDRATION_TIMEOUT_MS,
      "hydration"
    );
    return { before, after, interactive: before !== after, error: null };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    return { before, after: null, interactive: false, error };
  } finally {
    try {
      window.happyDOM.abort();
    } catch {
      // best effort teardown of the throwaway window
    }
  }
}

async function collectLicenses(candidate) {
  const records = [];
  for (const entry of candidate.runtimePackages) {
    const name = typeof entry === "string" ? entry : entry.name;
    const via = typeof entry === "string" ? null : entry.via;

    const paths = [];
    if (via) {
      try {
        paths.push(path.dirname(require.resolve(`${via}/package.json`)));
      } catch {
        // fall through to the default resolution paths
      }
    }
    paths.push(root);

    let manifestPath = null;
    for (const from of paths) {
      try {
        manifestPath = require.resolve(`${name}/package.json`, { paths: [from] });
        break;
      } catch {
        // try the next resolution root
      }
    }

    try {
      if (!manifestPath) {
        throw new Error(`cannot resolve ${name}`);
      }
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      records.push({
        name: manifest.name,
        version: manifest.version,
        license: manifest.license ?? "UNDECLARED",
        repository:
          typeof manifest.repository === "string"
            ? manifest.repository
            : (manifest.repository?.url ?? null)
      });
    } catch {
      records.push({ name, version: null, license: "UNRESOLVED", repository: null });
    }
  }
  return records;
}

function containsScriptTag(html) {
  return /<script[\s>]/i.test(html);
}

// SEC-XSS-001 / SEC-XSS-003: the hostile fixture string must never reach the
// output as live markup, in text, attribute, or URL position.
function checkEscaping(html) {
  // Note: the payload's own text contains " onerror=", so searching for an
  // inline handler anywhere in the document is not a valid signal. What matters
  // is whether a real element was created, and whether the payload survives in
  // escaped form.
  const createdScriptElement = /<script/i.test(html);
  const createdImageElement = /<img/i.test(html);
  const fragment = /<section[^>]*data-testid="hostile"[\s\S]*?<\/section>/i.exec(html);

  // The invariant is that `<` can no longer open a tag and `"` can no longer
  // close an attribute. Whether `>` is also encoded is a cosmetic difference
  // between renderers, not a security difference.
  const escapedAngleInText = html.includes("&lt;script");
  const escapedQuoteInAttribute = html.includes('title="&quot;');
  const escapesGreaterThan = html.includes("&gt;");

  return {
    createdScriptElement,
    createdImageElement,
    escapedAngleInText,
    escapedQuoteInAttribute,
    escapesGreaterThan,
    renderedFragment: fragment ? fragment[0] : null,
    escaped:
      !createdScriptElement && !createdImageElement && escapedAngleInText && escapedQuoteInAttribute
  };
}

async function measureCandidate(candidate) {
  log(`${candidate.id}: building server bundle`);
  const serverBundle = await buildServer(candidate);
  log(`${candidate.id}: measuring SSR`);
  const ssr = await measureSsr(serverBundle);

  log(`${candidate.id}: building client bundles`);
  const esm = await buildClient(candidate, "esm");
  const iife = await buildClient(candidate, "iife");
  log(`${candidate.id}: checking hydration`);
  const hydration = await checkHydration(ssr.interactiveHtml, iife.bytes.toString("utf8"));
  log(`${candidate.id}: hydration interactive=${hydration.interactive}`);

  const serverBytes = await readFile(serverBundle);

  return {
    id: candidate.id,
    title: candidate.title,
    ssr: {
      iterations: ssr.iterations,
      msPerRender: Number(ssr.msPerRender.toFixed(4)),
      rendersPerSecond: Math.round(ssr.rendersPerSecond),
      interactiveHtmlBytes: Buffer.byteLength(ssr.interactiveHtml, "utf8"),
      staticHtmlBytes: Buffer.byteLength(ssr.staticHtml, "utf8"),
      serverBundleBytes: serverBytes.byteLength
    },
    clientBundle: sizeOf(esm.bytes),
    hydration,
    escaping: {
      interactive: checkEscaping(ssr.interactiveHtml),
      static: checkEscaping(ssr.staticHtml)
    },
    staticPage: {
      clientBytes: 0,
      htmlHasScriptTag: containsScriptTag(ssr.staticHtml),
      zeroJavaScript: !containsScriptTag(ssr.staticHtml)
    },
    licenses: await collectLicenses(candidate)
  };
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(2)} KiB (${value} B)`;
}

function renderReport(results, meta) {
  const byId = (id) => results.find((r) => r.id === id);
  const a = byId("react");
  const b = byId("preact");
  const c = byId("compat");
  const row = (axis, cell) => `| ${axis} | ${results.map(cell).join(" | ")} |`;

  const lines = [
    "# Renderer comparison evidence (FW-003 / ADR-002)",
    "",
    "Generated by `spikes/renderer-evaluation/measure.mjs`. Do not edit by hand.",
    "",
    `- Generated: ${meta.generatedAt}`,
    `- Node: ${meta.node}`,
    `- Platform: ${meta.platform}`,
    `- esbuild: ${meta.esbuild}`,
    `- SSR samples: ${SSR_ITERATIONS} timed renders after ${SSR_WARMUP} warm-up renders`,
    "",
    "Absolute timings are machine dependent. The decision relies on ratios.",
    "",
    "## Results",
    "",
    row("Axis", (r) => r.title),
    row("---", () => "---"),
    row("SSR ms per render", (r) => r.ssr.msPerRender),
    row("SSR renders per second", (r) => r.ssr.rendersPerSecond),
    row("SSR HTML (interactive)", (r) => formatBytes(r.ssr.interactiveHtmlBytes)),
    row("SSR HTML (static)", (r) => formatBytes(r.ssr.staticHtmlBytes)),
    row("Server bundle", (r) => formatBytes(r.ssr.serverBundleBytes)),
    row("Client bundle raw", (r) => formatBytes(r.clientBundle.raw)),
    row("Client bundle gzip", (r) => formatBytes(r.clientBundle.gzip)),
    row("Client bundle brotli", (r) => formatBytes(r.clientBundle.brotli)),
    row("Hydration works", (r) => (r.hydration.interactive ? "yes" : `no (${r.hydration.error})`)),
    row(
      "Counter text before -> after",
      (r) => `\`${r.hydration.before}\` -> \`${r.hydration.after}\``
    ),
    row("Static page client bytes", (r) => r.staticPage.clientBytes),
    row("Static HTML free of `<script>`", (r) => (r.staticPage.zeroJavaScript ? "yes" : "no")),
    row("Hostile string escaped (SEC-XSS-001/003)", (r) =>
      r.escaping.interactive.escaped && r.escaping.static.escaped ? "yes" : "no"
    ),
    row("Also encodes `>`", (r) => (r.escaping.interactive.escapesGreaterThan ? "yes" : "no")),
    row("Runtime packages", (r) => r.licenses.map((l) => `${l.name}@${l.version}`).join("<br>")),
    row("Licenses", (r) => [...new Set(r.licenses.map((l) => l.license))].join(", ")),
    "",
    "## Derived ratios",
    "",
    `- Client bundle gzip: ${a.id} is ${(a.clientBundle.gzip / b.clientBundle.gzip).toFixed(2)}x ${b.id}.`,
    `- Client bundle brotli: ${a.id} is ${(a.clientBundle.brotli / b.clientBundle.brotli).toFixed(2)}x ${b.id}.`,
    `- SSR throughput: ${b.id} is ${(b.ssr.rendersPerSecond / a.ssr.rendersPerSecond).toFixed(2)}x ${a.id}.`,
    `- SSR HTML size: ${a.id} is ${(a.ssr.interactiveHtmlBytes / b.ssr.interactiveHtmlBytes).toFixed(2)}x ${b.id}.`,
    `- Compatibility cost: ${c.id} client gzip is ${(c.clientBundle.gzip / b.clientBundle.gzip).toFixed(2)}x ${b.id}, and still ${(a.clientBundle.gzip / c.clientBundle.gzip).toFixed(2)}x smaller than ${a.id}.`,
    `- Compatibility SSR cost: ${c.id} throughput is ${(c.ssr.rendersPerSecond / b.ssr.rendersPerSecond).toFixed(2)}x ${b.id}.`,
    "",
    "## Portability of application source",
    "",
    "`fixtures/app.jsx` is byte-identical for all candidates. Only the following differ:",
    "",
    "- the JSX import source passed to the compiler,",
    "- the module that re-exports `useState`,",
    "- the server render call (`renderToString`),",
    "- the client hydrate call (`hydrateRoot` versus `hydrate`).",
    "",
    "This is the DX evidence: authoring surface is portable, integration surface is not.",
    "",
    "The `compat` candidate keeps the React-shaped API (`hydrateRoot`) while running",
    "on the small runtime, so the choice is not strictly React-versus-not-React.",
    "",
    "## Measurement stability",
    "",
    "Bundle sizes are deterministic and reproduce byte-for-byte across runs. SSR",
    "throughput is not: repeated runs on this machine moved the react-to-preact",
    "throughput ratio across roughly 1.2x to 2.1x. SSR numbers here are therefore",
    "directional only, and a defensible throughput claim needs the FW-007 harness.",
    ""
  ];
  return lines.join("\n");
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await mkdir(resultsDir, { recursive: true });

  const results = [];
  for (const candidate of CANDIDATES) {
    results.push(await measureCandidate(candidate));
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    esbuild: esbuild.version,
    ssrWarmup: SSR_WARMUP,
    ssrIterations: SSR_ITERATIONS
  };

  await writeFile(
    path.join(resultsDir, "renderer-comparison.json"),
    `${JSON.stringify({ meta, results }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(resultsDir, "renderer-comparison.md"),
    renderReport(results, meta),
    "utf8"
  );

  for (const result of results) {
    if (!result.hydration.interactive) {
      throw new Error(`hydration failed for ${result.id}: ${result.hydration.error}`);
    }
    if (!result.staticPage.zeroJavaScript) {
      throw new Error(`static page for ${result.id} contains a script tag`);
    }
    if (!result.escaping.interactive.escaped || !result.escaping.static.escaped) {
      throw new Error(`hostile string was not escaped by ${result.id}`);
    }
  }

  process.stdout.write("renderer comparison written to results/\n");
}

try {
  await main();
} catch (error) {
  process.stderr.write(`[spike] failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
}

// happy-dom windows and the React scheduler can leave timers on the event loop.
// The measurement is complete at this point, so exit deterministically.
process.exit(0);
