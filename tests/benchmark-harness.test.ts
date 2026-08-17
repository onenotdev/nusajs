import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..");
const harnessPath = join(repositoryRoot, "benchmarks", "harness.mjs");
const outputDirectory = join(repositoryRoot, "benchmarks", "test-results");
const resultPath = join(outputDirectory, "harness-calibration.json");

function readText(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

interface BenchmarkResult {
  schemaVersion: number;
  framework: string;
  version: string;
  fixture: string;
  commit: string;
  generatedAt: string;
  environment: {
    os: string;
    architecture: string;
    cpu: string;
    logicalCpuCount: number;
    memoryBytes: number;
    runtime: string;
  };
  methodology: {
    warmupSamples: number;
    measuredSamples: number;
    cacheState: string;
    outlierPolicy: string;
    clock: string;
  };
  configHash: string;
  correctness: string;
  security: string;
  prerequisiteChecks: string[];
  samples: number[];
  summary: {
    unit: string;
    count: number;
    minimum: number;
    maximum: number;
    median: number;
    p95: number;
    p99: number;
    mean: number;
    standardDeviation: number;
  };
  claimScope: string;
}

function runHarness(...arguments_: string[]): string {
  return execFileSync(process.execPath, [harnessPath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
}

function readResult(): BenchmarkResult {
  return JSON.parse(readFileSync(resultPath, "utf8")) as BenchmarkResult;
}

beforeAll(() => {
  rmSync(outputDirectory, { recursive: true, force: true });
  runHarness(
    "--fixture",
    "harness-calibration",
    "--samples",
    "30",
    "--warmup",
    "2",
    "--output",
    "benchmarks/test-results"
  );
});

afterAll(() => {
  rmSync(outputDirectory, { recursive: true, force: true });
});

describe("FW-007 benchmark harness baseline", () => {
  it("runs every benchmark through the documented root command", () => {
    const manifest = JSON.parse(readText("package.json")) as { scripts: Record<string, string> };
    const readme = readText("benchmarks/README.md");

    expect(manifest.scripts["benchmark"]).toEqual("node benchmarks/harness.mjs");
    expect(manifest.scripts["benchmark:list"]).toEqual("node benchmarks/harness.mjs --list");
    expect(readme).toContain("pnpm run benchmark");
  });

  it("registers the complete B01 through B11 matrix without pretending it is implemented", () => {
    const registry = JSON.parse(readText("benchmarks/fixtures.json")) as {
      fixtures: Array<{ id: string; slug: string; status: string }>;
    };
    const planned = registry.fixtures.filter((fixture) => /^B\d{2}$/.test(fixture.id));

    expect(planned.map((fixture) => fixture.id)).toEqual(
      Array.from({ length: 11 }, (_, index) => `B${String(index + 1).padStart(2, "0")}`)
    );
    expect(planned.every((fixture) => fixture.status === "planned")).toBe(true);
    expect(new Set(planned.map((fixture) => fixture.slug)).size).toBe(11);
  });

  it("produces raw data and complete environment metadata", () => {
    const result = readResult();

    expect(result.schemaVersion).toBe(1);
    expect(result.framework).toBe("nusajs");
    expect(result.version).toBe("0.0.0");
    expect(result.fixture).toBe("harness-calibration");
    expect(result.commit).toMatch(/^(unavailable|[0-9a-f]{40})$/);
    expect(Date.parse(result.generatedAt)).not.toBeNaN();
    expect(result.configHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.environment.os.length).toBeGreaterThan(0);
    expect(result.environment.architecture.length).toBeGreaterThan(0);
    expect(result.environment.cpu.length).toBeGreaterThan(0);
    expect(result.environment.logicalCpuCount).toBeGreaterThan(0);
    expect(result.environment.memoryBytes).toBeGreaterThan(0);
    expect(result.environment.runtime).toEqual(process.version);
  });

  it("retains all samples and records the predeclared methodology", () => {
    const result = readResult();

    expect(result.methodology.warmupSamples).toBe(2);
    expect(result.methodology.measuredSamples).toBe(30);
    expect(result.methodology.cacheState.length).toBeGreaterThan(0);
    expect(result.methodology.outlierPolicy).toEqual("none; every measured sample is retained");
    expect(result.methodology.clock).toEqual("performance.now");
    expect(result.samples).toHaveLength(30);
    expect(result.samples.every((sample) => Number.isFinite(sample) && sample >= 0)).toBe(true);
  });

  it("reports every statistic required by the performance PRD", () => {
    const result = readResult();
    const sorted = [...result.samples].sort((left, right) => left - right);

    expect(result.summary.unit).toBe("ms");
    expect(result.summary.count).toBe(30);
    expect(result.summary.minimum).toBe(sorted[0]);
    expect(result.summary.maximum).toBe(sorted[sorted.length - 1]);
    expect(result.summary.median).toBe(sorted[14]);
    expect(result.summary.p95).toBe(sorted[28]);
    expect(result.summary.p99).toBe(sorted[29]);
    expect(result.summary.mean).toBeGreaterThanOrEqual(result.summary.minimum);
    expect(result.summary.mean).toBeLessThanOrEqual(result.summary.maximum);
    expect(result.summary.standardDeviation).toBeGreaterThanOrEqual(0);
  });

  it("records passing correctness and security prerequisites before samples", () => {
    const result = readResult();

    expect(result.correctness).toBe("pass");
    expect(result.security).toBe("pass");
    expect(result.prerequisiteChecks.length).toBeGreaterThan(0);
    expect(result.claimScope).toContain("not framework performance");
    expect(result.claimScope).toContain("not be used for marketing");
  });

  it("rejects a latency run with fewer than 30 samples", () => {
    const outcome = spawnSync(
      process.execPath,
      [harnessPath, "--samples", "29", "--output", "benchmarks/test-results"],
      { cwd: repositoryRoot, encoding: "utf8" }
    );

    expect(outcome.status).not.toBe(0);
    expect(outcome.stderr).toContain("require at least 30 samples");
  });

  it("rejects arbitrary fixture paths and malformed fixture identifiers", () => {
    const outcome = spawnSync(
      process.execPath,
      [harnessPath, "--fixture", "../package.json", "--output", "benchmarks/test-results"],
      { cwd: repositoryRoot, encoding: "utf8" }
    );

    expect(outcome.status).not.toBe(0);
    expect(outcome.stderr).toContain("lowercase fixture ID");
  });

  it("rejects output paths outside the repository", () => {
    const outcome = spawnSync(process.execPath, [harnessPath, "--output", "..\\outside"], {
      cwd: repositoryRoot,
      encoding: "utf8"
    });

    expect(outcome.status).not.toBe(0);
    expect(outcome.stderr).toContain("must remain inside the repository");
  });

  it("writes no result when argument validation fails", () => {
    expect(existsSync(join(outputDirectory, "package.json.json"))).toBe(false);
  });

  it("states that prerequisite status is scoped evidence, not a security discharge", () => {
    const readme = readText("benchmarks/README.md");

    expect(readme).toMatch(/does not discharge a `SEC-\*`\s+requirement/);
    expect(readme).toContain("No “faster” claim may cite calibration output");
  });

  it("keeps generated results out of version control", () => {
    const ignore = readText(".gitignore");

    expect(ignore).toContain("benchmarks/results/");
    expect(ignore).toContain("benchmarks/test-results/");
  });
});
