import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CORE_PACKAGE_NAME, CORE_VERSION } from "../src/index.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

describe("@nusajs/core", () => {
  it("exports documented package identity constants", () => {
    expect(CORE_PACKAGE_NAME).toBe("@nusajs/core");
    expect(CORE_VERSION).toBe("0.0.0");
  });

  it("contains no Node built-ins or runtime dependencies in source", () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(manifest.dependencies).toBeUndefined();

    for (const file of filesBelow(join(packageRoot, "src"))) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(packageRoot, file)).not.toMatch(
        /(?:from\s+|import\s*\()["'](?:node:|fs(?:\/|["'])|path(?:\/|["'])|process["'])/
      );
    }
  });
});
