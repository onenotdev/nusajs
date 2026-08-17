import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveFromEsmConsumer(specifier: string): string {
  return execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`
    ],
    { cwd: packageRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  ).trim();
}
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  name: string;
  private: boolean;
  type: string;
  exports: Record<string, unknown>;
  dependencies?: Record<string, string>;
};

describe("core package boundary", () => {
  it("is private, ESM-only, dependency-free, and explicitly exported", () => {
    expect(manifest).toMatchObject({ name: "@nusajs/core", private: true, type: "module" });
    expect(manifest.exports).toEqual({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" }
    });
    expect(manifest.dependencies).toBeUndefined();
    expect(manifest.exports["./experimental"]).toBeUndefined();
    expect(Object.keys(manifest.exports)).not.toContain("./internal/*");
  });

  it("allows the declared root and rejects undeclared and source deep imports", async () => {
    expect(resolveFromEsmConsumer("@nusajs/core")).toMatch(/\/dist\/index\.js$/);
    expect(() => resolveFromEsmConsumer("@nusajs/core/internal/package-marker")).toThrow();
    expect(() => resolveFromEsmConsumer("@nusajs/core/src/index.js")).toThrow();
    expect(() => resolveFromEsmConsumer("@nusajs/core/experimental")).toThrow();
  });

  it("matches the committed deterministic API report", () => {
    const report = `${readFileSync(join(packageRoot, "api", "core.api.txt"), "utf8")
      .replaceAll("\r\n", "\n")
      .replace(/^(?:\t+| +)/gm, "  ")
      .trim()}\n`;
    const generated = [
      "index.d.ts",
      "diagnostics.d.ts",
      "request-context.d.ts",
      "request-handler.d.ts",
      "route-matcher.d.ts",
      "renderer.d.ts",
      "security-headers.d.ts"
    ]
      .map((file) => {
        const declaration = readFileSync(join(packageRoot, "dist", file), "utf8")
          .replaceAll("\r\n", "\n")
          .replace(/^\/\/# sourceMappingURL=.*$/gm, "")
          .replace(/^(?:\t+| +)/gm, "  ")
          .trim();
        return `## ${file}\n${declaration}\n`;
      })
      .join("\n");
    expect(generated).toBe(report);
  });

  it("keeps built output free of runtime imports and Node built-ins", () => {
    for (const file of readdirSync(join(packageRoot, "dist"), { recursive: true })) {
      if (typeof file !== "string" || !file.endsWith(".js")) continue;
      const output = readFileSync(join(packageRoot, "dist", file), "utf8");
      const imports = [...output.matchAll(/(?:from\s+|import\s*\()["']([^"']+)["']/g)].map(
        (match) => match[1]
      );
      expect(imports, relative(packageRoot, file)).toEqual(
        imports.filter((specifier) => specifier?.startsWith("./") || specifier?.startsWith("../"))
      );
      expect(output).not.toMatch(/["']node:/);
    }
  });
});
