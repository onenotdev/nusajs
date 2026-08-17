import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import {
  createNusaVitePlugin,
  ROUTE_MANIFEST_VIRTUAL_ID,
  TYPED_ROUTES_VIRTUAL_ID
} from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(
  config = 'export default defineConfig({ output: "server", security: { mode: "strict" } });'
) {
  const root = await mkdtemp(join(tmpdir(), "nusajs-vite-"));
  roots.push(root);
  await mkdir(join(root, "src/routes/blog"), { recursive: true });
  await writeFile(join(root, "nusa.config.ts"), config);
  await writeFile(join(root, "src/routes/index.page.ts"), 'throw new Error("must not execute");');
  await writeFile(join(root, "src/routes/blog/[slug].page.ts"), "export const page = true;");
  await writeFile(
    join(root, "entry.ts"),
    `export { routeManifest } from ${JSON.stringify(ROUTE_MANIFEST_VIRTUAL_ID)}; export { href } from ${JSON.stringify(TYPED_ROUTES_VIRTUAL_ID)};`
  );
  return root;
}

async function compile(root: string): Promise<string> {
  await build({
    root,
    logLevel: "silent",
    plugins: [createNusaVitePlugin({ root })],
    build: {
      emptyOutDir: true,
      lib: { entry: join(root, "entry.ts"), formats: ["es"], fileName: "app" },
      minify: false
    }
  });
  const output = (await readdir(join(root, "dist"))).find(
    (file) => file.endsWith(".js") || file.endsWith(".mjs")
  );
  if (output === undefined) throw new Error("fixture build did not emit a JavaScript chunk");
  return readFile(join(root, "dist", output), "utf8");
}

describe("createNusaVitePlugin", () => {
  it("builds deterministic manifest and typed-route virtual modules without executing routes", async () => {
    const root = await fixture();
    const first = await compile(root);
    const second = await compile(root);
    expect(first).toBe(second);
    expect(first).toContain("/blog/[slug]");
    expect(first).toContain("function href");
    expect(first).toContain("encodeURIComponent");
    expect(first).not.toContain("must not execute");
  });

  it("rebuilds virtual output after a route edit", async () => {
    const root = await fixture();
    const first = await compile(root);
    await writeFile(join(root, "src/routes/health.endpoint.ts"), "export const endpoint = true;");
    const second = await compile(root);
    expect(first).not.toContain("/health");
    expect(second).toContain("/health");
  });

  it("fails closed for invalid config without emitting received secret values", async () => {
    const secret = "DO_NOT_EMIT_SECRET_7f94";
    const root = await fixture(
      `export default defineConfig({ output: ${JSON.stringify(secret)} });`
    );
    let message = "";
    try {
      await compile(root);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("NUSA-CONFIG-0001");
    expect(message).toContain("<config>.output");
    expect(message).not.toContain(secret);
  });

  it("rejects relative roots and route/config paths escaping the application root", async () => {
    expect(() => createNusaVitePlugin({ root: "relative" })).toThrow("root must be absolute");
    const root = await fixture();
    await expect(
      build({
        root,
        logLevel: "silent",
        plugins: [createNusaVitePlugin({ root, routesDirectory: "../escape" })]
      })
    ).rejects.toThrow("routesDirectory must remain inside");
    await expect(
      build({
        root,
        logLevel: "silent",
        plugins: [createNusaVitePlugin({ root, configFile: "../secret.ts" })]
      })
    ).rejects.toThrow("configFile must remain inside");
  });
});
