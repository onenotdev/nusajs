import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..");

interface RootPackage {
  name?: string;
  private?: boolean;
  type?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface BaseTsConfig {
  compilerOptions?: {
    strict?: boolean;
    noUncheckedIndexedAccess?: boolean;
    exactOptionalPropertyTypes?: boolean;
    verbatimModuleSyntax?: boolean;
    module?: string;
  };
}

interface BiomeConfig {
  linter?: {
    enabled?: boolean;
    rules?: {
      suspicious?: {
        noExplicitAny?: string;
      };
    };
  };
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(repositoryRoot, relativePath), "utf8")) as T;
}

function readText(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

describe("workspace skeleton", () => {
  it("declares a private, ESM-only root package", () => {
    const rootPackage = readJson<RootPackage>("package.json");

    expect(rootPackage.private).toBe(true);
    expect(rootPackage.type).toBe("module");
    expect(rootPackage.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
  });

  it("pins every development dependency to an exact version", () => {
    const devDependencies = readJson<RootPackage>("package.json").devDependencies ?? {};

    expect(Object.keys(devDependencies).length).toBeGreaterThan(0);

    for (const version of Object.values(devDependencies)) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("declares no runtime dependencies in the skeleton", () => {
    expect(readJson<RootPackage>("package.json").dependencies).toBeUndefined();
  });

  it("exposes the required quality gate scripts", () => {
    const scripts = readJson<RootPackage>("package.json").scripts ?? {};

    for (const script of ["format:check", "lint", "typecheck", "test", "verify"]) {
      expect(scripts[script]).toBeTypeOf("string");
    }
  });

  it("enables TypeScript strict mode in the shared base configuration", () => {
    const compilerOptions = readJson<BaseTsConfig>("tsconfig.base.json").compilerOptions;

    expect(compilerOptions?.strict).toBe(true);
    expect(compilerOptions?.noUncheckedIndexedAccess).toBe(true);
    expect(compilerOptions?.exactOptionalPropertyTypes).toBe(true);
    expect(compilerOptions?.verbatimModuleSyntax).toBe(true);
    expect(compilerOptions?.module).toBe("ESNext");
  });

  it("treats explicit any as a lint error", () => {
    const linter = readJson<BiomeConfig>("biome.json").linter;

    expect(linter?.enabled).toBe(true);
    expect(linter?.rules?.suspicious?.noExplicitAny).toBe("error");
  });

  it("defines the workspace package globs", () => {
    const workspaceFile = readText("pnpm-workspace.yaml");

    expect(workspaceFile).toContain('"packages/*"');
    expect(workspaceFile).toContain('"examples/*"');
  });

  it("denies unreviewed dependency install scripts", () => {
    const workspaceFile = readText("pnpm-workspace.yaml");

    expect(workspaceFile).toContain("allowBuilds:");
    expect(workspaceFile).not.toMatch(/^\s+\S+: true$/m);
  });

  it("runs the same quality gates in continuous integration", () => {
    const workflow = readText(".github/workflows/ci.yml");

    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm run format:check");
    expect(workflow).toContain("pnpm run lint");
    expect(workflow).toContain("pnpm run typecheck");
    expect(workflow).toContain("pnpm run test");

    for (const os of ["ubuntu-latest", "windows-latest", "macos-latest"]) {
      expect(workflow).toContain(os);
    }
  });

  it("contains no framework feature packages yet", () => {
    expect(existsSync(join(repositoryRoot, "packages"))).toBe(false);
  });

  it("keeps measurement spikes private and outside the framework graph", () => {
    const spikesDir = join(repositoryRoot, "spikes");
    if (!existsSync(spikesDir)) {
      return;
    }

    const spikes = readdirSync(spikesDir, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory()
    );

    expect(spikes.length).toBeGreaterThan(0);

    for (const spike of spikes) {
      const manifest = readJson<RootPackage>(join("spikes", spike.name, "package.json"));

      // A spike is throwaway evidence, never a shipped artifact.
      expect(manifest.private).toBe(true);
      // Spikes may not carry runtime dependencies, so they cannot become part of
      // the framework dependency graph by accident.
      expect(manifest.dependencies).toBeUndefined();
      // The framework scope is reserved for real packages (ADR-001).
      expect(manifest.name?.startsWith("@nusajs/")).toBe(false);
    }
  });
});
