import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RouteScanError, scanRouteFiles } from "../src/index.js";

const roots: string[] = [];

async function fixture(files: readonly string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "nusajs-scanner-"));
  roots.push(root);
  for (const file of files) {
    const target = join(root, ...file.split("/"));
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, "throw new Error('route modules must not execute');\n", "utf8");
  }
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("filesystem route scanner", () => {
  it("classifies every suffix role and ignores unrelated files without executing modules", async () => {
    const root = await fixture([
      "z/[...path].endpoint.ts",
      "(marketing)/about.page.tsx",
      "[id]/index.page.ts",
      "[[lang]]/_layout.tsx",
      "[[...path]]/_error.ts",
      "blog/_loading.js",
      "README.md",
      "plain.ts"
    ]);

    await expect(scanRouteFiles({ root })).resolves.toEqual([
      {
        kind: "page",
        relativePath: "(marketing)/about.page.tsx",
        normalizedPath: "(marketing)/about.page.tsx"
      },
      {
        kind: "error",
        relativePath: "[[...path]]/_error.ts",
        normalizedPath: "[[...path]]/_error.ts"
      },
      {
        kind: "layout",
        relativePath: "[[lang]]/_layout.tsx",
        normalizedPath: "[[lang]]/_layout.tsx"
      },
      { kind: "page", relativePath: "[id]/index.page.ts", normalizedPath: "[id]/index.page.ts" },
      { kind: "loading", relativePath: "blog/_loading.js", normalizedPath: "blog/_loading.js" },
      {
        kind: "endpoint",
        relativePath: "z/[...path].endpoint.ts",
        normalizedPath: "z/[...path].endpoint.ts"
      }
    ]);
  });

  it("returns immutable records in the same order for different creation orders", async () => {
    const paths = ["z.page.ts", "a.page.ts", "nested/b.endpoint.ts"];
    const first = await fixture(paths);
    const second = await fixture([...paths].reverse());
    const firstResult = await scanRouteFiles({ root: first });
    const secondResult = await scanRouteFiles({ root: second });

    expect(firstResult).toEqual(secondResult);
    expect(Object.isFrozen(firstResult)).toBe(true);
    expect(firstResult.every(Object.isFrozen)).toBe(true);
  });

  it("rejects relative and missing roots", async () => {
    await expect(scanRouteFiles({ root: "routes" })).rejects.toBeInstanceOf(RouteScanError);
    await expect(
      scanRouteFiles({ root: join(tmpdir(), "missing-nusajs-routes") })
    ).rejects.toMatchObject({
      diagnostics: [{ code: "NUSA-SECURITY-0001" }]
    });
  });

  it("rejects Windows reserved device names in files and directories", async () => {
    const root = await fixture(["con.page.ts", "nested/AUX/ok.page.ts"]);
    await expect(scanRouteFiles({ root })).rejects.toMatchObject({
      diagnostics: [
        { code: "NUSA-ROUTE-0001", file: "con.page.ts" },
        { code: "NUSA-ROUTE-0001", file: "nested/AUX/ok.page.ts" }
      ]
    });
  });

  it("reports every case-folded collision deterministically", async () => {
    const root = await fixture(["Blog.page.ts", "blog.page.ts"]);
    const entries = await readdir(root);
    if (entries.length === 2) {
      await expect(scanRouteFiles({ root })).rejects.toMatchObject({
        diagnostics: [
          { code: "NUSA-ROUTE-0001", file: "Blog.page.ts" },
          { code: "NUSA-ROUTE-0001", file: "blog.page.ts" }
        ]
      });
    } else {
      expect(entries).toHaveLength(1);
      await expect(scanRouteFiles({ root })).resolves.toHaveLength(1);
    }
  });

  it("reports every NFC-normalized collision when the host can represent both spellings", async () => {
    const root = await fixture(["caf\u00e9.page.ts", "cafe\u0301.page.ts"]);
    const entries = await readdir(root);
    if (entries.length === 2) {
      await expect(scanRouteFiles({ root })).rejects.toMatchObject({
        diagnostics: [
          { code: "NUSA-ROUTE-0001", file: "cafe\u0301.page.ts" },
          { code: "NUSA-ROUTE-0001", file: "caf\u00e9.page.ts" }
        ]
      });
    } else {
      expect(entries).toHaveLength(1);
    }
  });

  it("rejects symlinks that escape the configured root", async () => {
    const root = await fixture([]);
    const outside = await fixture(["secret.page.ts"]);
    await symlink(outside, join(root, "escape"), "junction");

    await expect(scanRouteFiles({ root })).rejects.toMatchObject({
      diagnostics: [{ code: "NUSA-SECURITY-0001", file: "escape" }]
    });
  });

  it("rejects in-root directory links instead of assigning route identity through aliases", async () => {
    const root = await fixture(["real/about.page.ts"]);
    await symlink(join(root, "real"), join(root, "alias"), "junction");
    await expect(scanRouteFiles({ root })).rejects.toMatchObject({
      diagnostics: [{ code: "NUSA-SECURITY-0001", file: "alias" }]
    });
  });

  it("rejects a route root that is itself a directory link", async () => {
    const target = await fixture(["index.page.ts"]);
    const container = await fixture([]);
    const linkedRoot = join(container, "routes");
    await symlink(target, linkedRoot, "junction");
    await expect(scanRouteFiles({ root: linkedRoot })).rejects.toMatchObject({
      diagnostics: [{ code: "NUSA-SECURITY-0001" }]
    });
  });

  it("rejects route file links when the host permits creating them", async () => {
    const root = await fixture(["real.page.ts"]);
    try {
      await symlink(join(root, "real.page.ts"), join(root, "alias.page.ts"), "file");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") return;
      throw error;
    }
    await expect(scanRouteFiles({ root })).rejects.toMatchObject({
      diagnostics: [{ code: "NUSA-SECURITY-0001", file: "alias.page.ts" }]
    });
  });
});
