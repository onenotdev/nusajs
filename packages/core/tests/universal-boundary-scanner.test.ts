import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatBoundaryViolation,
  scanUniversalPackages
} from "../../../scripts/check-universal-boundaries.mjs";

const temporaryRoots: string[] = [];

async function fixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "nusajs-boundary-"));
  temporaryRoots.push(root);
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  return root;
}

const fixturePackages = Object.freeze([{ name: "@example/universal", root: "packages/universal" }]);

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("universal package boundary scanner", () => {
  it("passes the repository source and built output", async () => {
    await expect(scanUniversalPackages()).resolves.toEqual([]);
  });

  it("accepts Web Standards and package imports", async () => {
    const root = await fixture({
      "packages/universal/src/index.ts":
        'import { render } from "preact"; export const url = new URL("https://example.test");\n',
      "packages/universal/dist/index.js": 'export { render } from "preact";\n'
    });

    await expect(
      scanUniversalPackages({ repositoryRoot: root, packages: fixturePackages })
    ).resolves.toEqual([]);
  });

  it("rejects static, type, dynamic, and CommonJS Node built-in imports in source and output", async () => {
    const root = await fixture({
      "packages/universal/src/static.ts": 'import { readFile } from "node:fs/promises";\n',
      "packages/universal/src/type.ts": 'type BufferType = import("buffer").Buffer;\n',
      "packages/universal/src/dynamic.ts": 'export const load = () => import("node:crypto");\n',
      "packages/universal/dist/common.cjs": 'const path = require("path");\n'
    });

    const violations = await scanUniversalPackages({
      repositoryRoot: root,
      packages: fixturePackages
    });

    expect(violations).toEqual([
      expect.objectContaining({ code: "NUSA_BOUNDARY_NODE_BUILTIN", specifier: "path" }),
      expect.objectContaining({ code: "NUSA_BOUNDARY_NODE_BUILTIN", specifier: "node:crypto" }),
      expect.objectContaining({
        code: "NUSA_BOUNDARY_NODE_BUILTIN",
        specifier: "node:fs/promises"
      }),
      expect.objectContaining({ code: "NUSA_BOUNDARY_NODE_BUILTIN", specifier: "buffer" })
    ]);
  });

  it("formats a stable value-free diagnostic", () => {
    expect(
      formatBoundaryViolation({
        code: "NUSA_BOUNDARY_NODE_BUILTIN",
        package: "@example/universal",
        file: "packages/universal/src/secret.ts",
        specifier: "node:fs"
      })
    ).toBe(
      'NUSA_BOUNDARY_NODE_BUILTIN: @example/universal imports "node:fs" in packages/universal/src/secret.ts'
    );
  });
});
