import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  name: string;
  private: boolean;
  type: string;
  exports: Record<string, unknown>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("compiler package boundary", () => {
  it("is private, ESM-only, and explicitly exported with exact compiler dependencies", () => {
    expect(manifest).toMatchObject({ name: "@nusajs/compiler", private: true, type: "module" });
    expect(manifest.exports).toEqual({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" }
    });
    // The static, non-executing config loader parses configuration through the same
    // TypeScript parser the repository toolchain already pins (ADR-005 toolchain).
    expect(manifest.dependencies).toEqual({ typescript: "5.9.3", vite: "7.3.6" });
    expect(manifest.devDependencies).toEqual({
      "@nusajs/adapter-node": "workspace:*",
      "@nusajs/core": "workspace:*",
      "@nusajs/renderer-preact": "workspace:*"
    });
  });

  it("keeps built output limited to relative modules and explicit Node built-ins", () => {
    for (const file of readdirSync(join(packageRoot, "dist"), { recursive: true })) {
      if (typeof file !== "string" || !file.endsWith(".js")) continue;
      const output = readFileSync(join(packageRoot, "dist", file), "utf8");
      const imports = [...output.matchAll(/(?:from\s+|import\s*\()["']([^"']+)["']/g)].map(
        (match) => match[1]
      );
      expect(imports, relative(packageRoot, file)).toEqual(
        imports.filter(
          (specifier) =>
            specifier?.startsWith("./") ||
            specifier?.startsWith("../") ||
            specifier?.startsWith("node:") ||
            specifier === "typescript" ||
            specifier === "vite"
        )
      );
    }
  });
});
