import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
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

async function compileWithCanary(root: string, canary: string, sourcemap: boolean): Promise<void> {
  await build({
    root,
    logLevel: "silent",
    plugins: [
      createNusaVitePlugin({
        root,
        canarySecretScan: { canaries: [new TextEncoder().encode(canary)] }
      })
    ],
    build: {
      emptyOutDir: true,
      sourcemap,
      lib: { entry: join(root, "entry.ts"), formats: ["es"], fileName: "app" },
      minify: true
    }
  });
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

  it("scans final production artifacts before a Vite build resolves", async () => {
    const root = await fixture();
    const canary = "NUSA_CANARY_final_bundle_9031";
    await writeFile(join(root, "entry.ts"), `export const leaked = ${JSON.stringify(canary)};`);
    let message = "";
    try {
      await compileWithCanary(root, canary, false);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("NUSA-SECURITY-0002");
    expect(message).toContain("JavaScript artifact");
    expect(message).not.toContain(canary);
    expect(message).not.toContain(root);
  });

  it("detects a canary retained only in final source-map bytes", async () => {
    const root = await fixture();
    const canary = "NUSA_CANARY_source_map_only_4792";
    await writeFile(join(root, "entry.ts"), `// ${canary}\nexport const retainedValue = "safe";`);
    let message = "";
    try {
      await compileWithCanary(root, canary, true);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("NUSA-SECURITY-0002");
    expect(message).toContain("source map artifact");
    expect(message).not.toContain(canary);
    expect(message).not.toContain(root);
  });

  it("allows clean final artifacts when scanning is enabled", async () => {
    const root = await fixture();
    await expect(compileWithCanary(root, "NUSA_CANARY_absent_1289", true)).resolves.toBeUndefined();
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

  it("rejects linked application, config, and route roots without exposing host paths", async () => {
    const root = await fixture();
    const container = await fixture();
    const rootAlias = join(container, "app-link");
    await symlink(root, rootAlias, "junction");
    await expect(compile(rootAlias)).rejects.toThrow("root must be a regular directory");

    const outside = await fixture();
    await rm(join(root, "src/routes"), { force: true, recursive: true });
    await symlink(join(outside, "src/routes"), join(root, "src/routes"), "junction");
    await expect(compile(root)).rejects.toThrow("routesDirectory must be a regular directory");

    await rm(join(root, "nusa.config.ts"), { force: true });
    try {
      await symlink(join(outside, "nusa.config.ts"), join(root, "nusa.config.ts"), "file");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") return;
      throw error;
    }
    let message = "";
    try {
      await compile(root);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("configFile must be a regular file");
    expect(message).not.toContain(root);
    expect(message).not.toContain(outside);
  });
});
