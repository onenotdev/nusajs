import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  name: string;
  private: boolean;
  type: string;
  exports: Record<string, unknown>;
  dependencies: Record<string, string>;
};

describe("Preact renderer package boundary", () => {
  it("is ESM-only with exact reviewed runtime dependencies and one public entry", () => {
    expect(manifest).toMatchObject({
      name: "@nusajs/renderer-preact",
      private: true,
      type: "module",
      exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
      dependencies: {
        "@nusajs/core": "workspace:*",
        preact: "10.29.8",
        "preact-render-to-string": "6.7.0"
      }
    });
  });

  it("keeps built output free of Node built-ins", () => {
    for (const file of readdirSync(join(packageRoot, "dist"))) {
      if (!file.endsWith(".js")) continue;
      expect(readFileSync(join(packageRoot, "dist", file), "utf8")).not.toMatch(/["']node:/);
    }
  });

  it("matches the committed deterministic API report", () => {
    const normalize = (text: string) =>
      `${text
        .replaceAll("\r\n", "\n")
        .replace(/^\/\/# sourceMappingURL=.*$/gm, "")
        .replace(/^(?:\t+| +)/gm, "  ")
        .trim()}\n`;
    const report = normalize(
      readFileSync(join(packageRoot, "api", "renderer-preact.api.txt"), "utf8")
    );
    const declaration = normalize(readFileSync(join(packageRoot, "dist", "index.d.ts"), "utf8"));
    expect(`## index.d.ts\n${declaration}`).toBe(report);
  });

  it("rejects undeclared deep imports", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--input-type=module", "--eval", "import('@nusajs/renderer-preact/src/index.js')"],
        { cwd: packageRoot, stdio: "pipe" }
      )
    ).toThrow();
  });
});
