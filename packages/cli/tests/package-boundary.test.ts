import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  readonly bin: Record<string, string>;
  readonly dependencies: Record<string, string>;
  readonly exports: Record<string, unknown>;
  readonly name: string;
  readonly private: boolean;
  readonly type: string;
};

describe("CLI package boundary", () => {
  it("is private, ESM-only, and exposes one provisional binary and root API", () => {
    expect(manifest).toMatchObject({ name: "@nusajs/cli", private: true, type: "module" });
    expect(manifest.bin).toEqual({ nusajs: "./dist/bin.js" });
    expect(manifest.exports).toEqual({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" }
    });
  });

  it("uses only the private compiler bridge and exact Vite version", () => {
    expect(manifest.dependencies).toEqual({
      "@nusajs/compiler": "workspace:*",
      vite: "7.3.6"
    });
    const output = readFileSync(join(packageRoot, "dist/index.js"), "utf8");
    const imports = [...output.matchAll(/(?:from\s+|import\s*\()["']([^"']+)["']/g)].map(
      (match) => match[1]
    );
    expect(imports).toEqual(
      imports.filter(
        (specifier) =>
          specifier?.startsWith("./") ||
          specifier?.startsWith("node:") ||
          specifier === "@nusajs/compiler" ||
          specifier === "vite"
      )
    );
  });
});
