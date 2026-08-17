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

describe("node adapter package boundary", () => {
  it("is private, ESM-only, and explicitly exported with only the core dependency", () => {
    expect(manifest).toMatchObject({ name: "@nusajs/adapter-node", private: true, type: "module" });
    expect(manifest.exports).toEqual({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" }
    });
    expect(manifest.dependencies).toEqual({ "@nusajs/core": "workspace:*" });
  });

  it("allows the declared root and rejects undeclared and source deep imports", async () => {
    expect(resolveFromEsmConsumer("@nusajs/adapter-node")).toMatch(/\/dist\/index\.js$/);
    expect(() => resolveFromEsmConsumer("@nusajs/adapter-node/node-server")).toThrow();
    expect(() => resolveFromEsmConsumer("@nusajs/adapter-node/src/index.js")).toThrow();
  });

  it("matches the committed deterministic API report", () => {
    const report = `${readFileSync(join(packageRoot, "api", "adapter-node.api.txt"), "utf8")
      .replaceAll("\r\n", "\n")
      .replace(/^(?:\\t+| +)/gm, "  ")
      .trim()}\n`;
    const generated = ["index.d.ts", "node-server.d.ts"]
      .map((file) => {
        const declaration = readFileSync(join(packageRoot, "dist", file), "utf8")
          .replaceAll("\r\n", "\n")
          .replace(/^\/\/# sourceMappingURL=.*$/gm, "")
          .replace(/^(?:\\t+| +)/gm, "  ")
          .trim();
        return `## ${file}\n${declaration}\n`;
      })
      .join("\n");
    expect(generated).toBe(report);
  });

  it("keeps built output limited to relative modules, core, and explicit Node built-ins", () => {
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
            specifier === "@nusajs/core"
        )
      );
    }
  });
});
