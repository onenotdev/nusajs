import { cpus, freemem, platform, release, totalmem } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";

const benchmarksDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(benchmarksDirectory, "..");
const fixtureDirectory = join(benchmarksDirectory, "fixtures");
const defaultOutputDirectory = join(benchmarksDirectory, "results");
const fixtureIdPattern = /^[a-z][a-z0-9-]{0,63}$/;
const minimumShortSampleCount = 30;

function demand(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isInside(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === "" || (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== "..")
  );
}

function parsePositiveInteger(value, flag) {
  demand(/^\d+$/.test(value), `${flag} must be a positive integer`);
  const parsed = Number.parseInt(value, 10);
  demand(parsed > 0, `${flag} must be greater than zero`);
  return parsed;
}

export function parseArguments(arguments_) {
  const options = {
    fixture: "harness-calibration",
    samples: minimumShortSampleCount,
    warmup: 5,
    output: defaultOutputDirectory,
    list: false
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--list") {
      options.list = true;
      continue;
    }

    const value = arguments_[index + 1];
    demand(value !== undefined, `${argument} requires a value`);

    if (argument === "--fixture") {
      demand(fixtureIdPattern.test(value), "--fixture must be a lowercase fixture ID");
      options.fixture = value;
    } else if (argument === "--samples") {
      options.samples = parsePositiveInteger(value, argument);
    } else if (argument === "--warmup") {
      options.warmup = parsePositiveInteger(value, argument);
    } else if (argument === "--output") {
      const output = resolve(repositoryRoot, value);
      demand(isInside(repositoryRoot, output), "--output must remain inside the repository");
      options.output = output;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
    index += 1;
  }

  demand(
    options.samples >= minimumShortSampleCount,
    "short latency benchmarks require at least 30 samples"
  );
  return options;
}

function quantile(sortedValues, probability) {
  demand(sortedValues.length > 0, "cannot summarize an empty sample set");
  const index = Math.ceil(probability * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

export function summarize(samples) {
  demand(samples.length > 0, "cannot summarize an empty sample set");
  demand(
    samples.every((sample) => Number.isFinite(sample) && sample >= 0),
    "samples must be finite non-negative numbers"
  );

  const sorted = [...samples].sort((left, right) => left - right);
  const sum = sorted.reduce((total, sample) => total + sample, 0);
  const mean = sum / sorted.length;
  const variance =
    sorted.reduce((total, sample) => total + (sample - mean) ** 2, 0) / sorted.length;

  return {
    unit: "ms",
    count: sorted.length,
    minimum: sorted[0],
    maximum: sorted[sorted.length - 1],
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    mean,
    standardDeviation: Math.sqrt(variance)
  };
}

async function loadFixture(fixtureId) {
  demand(fixtureIdPattern.test(fixtureId), "invalid fixture ID");
  const fixturePath = join(fixtureDirectory, `${fixtureId}.mjs`);
  demand(isInside(fixtureDirectory, fixturePath), "fixture path escaped the fixture directory");
  const fixture = await import(pathToFileURL(fixturePath).href);

  demand(fixture.id === fixtureId, "fixture module ID does not match its filename");
  demand(typeof fixture.prerequisites === "function", "fixture must export prerequisites()");
  demand(typeof fixture.measure === "function", "fixture must export measure()");
  return fixture;
}

async function readManifest() {
  return JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
}

function commitReference() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "unavailable";
  }
}

function environmentMetadata() {
  const cpu = cpus()[0];
  return {
    os: `${platform()} ${release()}`,
    architecture: process.arch,
    cpu: cpu?.model ?? "unavailable",
    logicalCpuCount: cpus().length,
    memoryBytes: totalmem(),
    freeMemoryBytesAtStart: freemem(),
    runtime: process.version,
    runtimeExecutable: process.release.name
  };
}

async function runPrerequisites(fixture) {
  const result = await fixture.prerequisites();
  demand(result !== null && typeof result === "object", "prerequisites() must return an object");
  demand(
    result.correctness === "pass",
    `correctness prerequisite did not pass: ${result.correctness}`
  );
  demand(result.security === "pass", `security prerequisite did not pass: ${result.security}`);
  demand(
    Array.isArray(result.checks) && result.checks.length > 0,
    "prerequisites must record at least one check"
  );
  return result;
}

export async function runBenchmark(options) {
  const fixture = await loadFixture(options.fixture);
  const prerequisites = await runPrerequisites(fixture);

  for (let index = 0; index < options.warmup; index += 1) {
    await fixture.measure();
  }

  const samples = [];
  for (let index = 0; index < options.samples; index += 1) {
    const started = performance.now();
    await fixture.measure();
    samples.push(performance.now() - started);
  }

  const manifest = await readManifest();
  return {
    schemaVersion: 1,
    framework: "nusajs",
    version: manifest.version,
    fixture: fixture.id,
    fixtureKind: fixture.kind,
    commit: commitReference(),
    generatedAt: new Date().toISOString(),
    environment: environmentMetadata(),
    methodology: {
      warmupSamples: options.warmup,
      measuredSamples: options.samples,
      cacheState: fixture.cacheState,
      outlierPolicy: "none; every measured sample is retained",
      clock: "performance.now"
    },
    configHash: fixture.configHash,
    correctness: prerequisites.correctness,
    security: prerequisites.security,
    prerequisiteChecks: prerequisites.checks,
    samples,
    summary: summarize(samples),
    claimScope: fixture.claimScope
  };
}

async function listFixtures() {
  const registry = JSON.parse(await readFile(join(benchmarksDirectory, "fixtures.json"), "utf8"));
  for (const fixture of registry.fixtures) {
    process.stdout.write(`${fixture.id}\t${fixture.status}\t${fixture.description}\n`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.list) {
    await listFixtures();
    return;
  }

  const result = await runBenchmark(options);
  await mkdir(options.output, { recursive: true });
  const outputPath = join(options.output, `${result.fixture}.json`);
  demand(isInside(options.output, outputPath), "result path escaped the output directory");
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`benchmark result written to ${relative(repositoryRoot, outputPath)}\n`);
}

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`benchmark harness failed: ${message}\n`);
    process.exitCode = 1;
  });
}
