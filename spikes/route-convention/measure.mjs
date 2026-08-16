// FW-004 route convention and module API evaluation harness.
//
// Measures three candidate filesystem conventions and two candidate route-module
// APIs against one shared logical route set, then writes a JSON and a Markdown
// report for ADR-003 and ADR-004.
//
// This is throwaway measurement code. It is not framework source, nothing here is
// public API, and no framework package may import it. It exists so that ADR-003 and
// ADR-004 are decided from observed behaviour instead of taste.
//
// The harness is enforcing, not merely reporting: it exits non-zero when a candidate
// fails a hard requirement, so a regression in the fixture cannot be mistaken for a
// successful measurement.

import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import ts from "typescript";
import { CONVENTIONS, compareSpecificity, specificityKey } from "./conventions.mjs";
import { COLLISION_CASES, LOGICAL_BOUNDARIES, LOGICAL_ROUTES } from "./fixtures/logical-routes.mjs";

const root = import.meta.dirname;
const resultsDir = path.join(root, "results");
const moduleApiDir = path.join(root, "fixtures", "module-api");

/** Hard requirement failures. A non-empty list makes the harness exit non-zero. */
const failures = [];

function log(message) {
  process.stderr.write(`[spike] ${message}\n`);
}

function demand(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

// ---------------------------------------------------------------------------
// Shared analysis used by every filesystem convention.
// ---------------------------------------------------------------------------

/**
 * Erase parameter names from a URL pattern so that `/blog/[slug]` and `/blog/[id]`
 * compare equal. Two routes with the same erased pattern claim the same URLs and
 * are therefore a collision regardless of what the author called the parameter.
 *
 * @param {string} pattern
 * @returns {string}
 */
function erasePattern(pattern) {
  return pattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith("[[...")) {
        return "[[...]]";
      }
      if (segment.startsWith("[...")) {
        return "[...]";
      }
      if (segment.startsWith("[[")) {
        return "[[]]";
      }
      if (segment.startsWith("[")) {
        return "[]";
      }
      return segment;
    })
    .join("/");
}

/**
 * Enumerate the concrete URLs a pattern can match at zero-parameter width. An
 * optional segment and an optional catch-all both also match the shorter URL, which
 * is how `/[[lang]]/welcome` can shadow `/welcome`.
 *
 * @param {string} pattern
 * @returns {string[]}
 */
function shadowedUrls(pattern) {
  const segments = pattern.split("/").filter((segment) => segment.length > 0);
  const results = new Set();
  const walk = (index, accumulated) => {
    if (index === segments.length) {
      results.add(`/${accumulated.join("/")}`.replace(/\/+$/, "") || "/");
      return;
    }
    const segment = segments[index];
    const optional = segment.startsWith("[[");
    if (optional) {
      walk(index + 1, accumulated);
    }
    walk(index + 1, [...accumulated, segment]);
  };
  walk(0, []);
  return [...results];
}

/**
 * Detect collisions in a set of `{ file, pattern }` entries and name every
 * conflicting file, as AC-ROUTE-02 requires.
 *
 * @param {{ file: string, pattern: string }[]} entries
 * @returns {{ kind: string, key: string, files: string[] }[]}
 */
function detectCollisions(entries) {
  const conflicts = [];

  const byErased = new Map();
  for (const entry of entries) {
    const key = erasePattern(entry.pattern);
    const bucket = byErased.get(key) ?? [];
    bucket.push(entry.file);
    byErased.set(key, bucket);
  }
  for (const [key, files] of byErased) {
    if (files.length > 1) {
      conflicts.push({ kind: "same-url", key, files: [...files].sort() });
    }
  }

  const byShadow = new Map();
  for (const entry of entries) {
    for (const url of shadowedUrls(entry.pattern)) {
      const bucket = byShadow.get(url) ?? new Set();
      bucket.add(entry.file);
      byShadow.set(url, bucket);
    }
  }
  for (const [url, files] of byShadow) {
    if (files.size > 1) {
      const sorted = [...files].sort();
      const already = conflicts.some((conflict) => conflict.files.join("|") === sorted.join("|"));
      if (!already) {
        conflicts.push({ kind: "shadowed-url", key: url, files: sorted });
      }
    }
  }

  return conflicts;
}

/**
 * Count route pairs whose specificity keys are indistinguishable while their
 * patterns differ. Any such pair would force filesystem enumeration order to decide
 * precedence, which docs/03_ROUTING_AND_NAVIGATION.md forbids.
 *
 * @param {{ pattern: string }[]} routes
 * @returns {string[][]}
 */
function precedenceTies(routes) {
  const ties = [];
  for (let i = 0; i < routes.length; i += 1) {
    for (let j = i + 1; j < routes.length; j += 1) {
      const a = routes[i];
      const b = routes[j];
      if (erasePattern(a.pattern) === erasePattern(b.pattern)) {
        continue;
      }
      const overlap = shadowedUrls(a.pattern).some((url) => shadowedUrls(b.pattern).includes(url));
      if (!overlap) {
        continue;
      }
      if (compareSpecificity(specificityKey(a.pattern), specificityKey(b.pattern)) === 0) {
        ties.push([a.pattern, b.pattern]);
      }
    }
  }
  return ties;
}

// ---------------------------------------------------------------------------
// Cross-platform filesystem probes (NFR-009).
// ---------------------------------------------------------------------------

/**
 * Write a probe file and confirm the bytes are really on disk. A bare write can
 * appear to succeed while the path resolves to something other than a file, so the
 * probe verifies the size rather than trusting the absence of an error.
 *
 * @param {string} target
 * @returns {Promise<string>} `"created"`, `"not-a-file"`, or the error code.
 */
async function writeProbeFile(target) {
  const payload = "// probe\n";
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, payload, "utf8");
  } catch (error) {
    return error.code ?? "UNKNOWN";
  }
  try {
    const stats = await stat(target);
    if (!stats.isFile() || stats.size !== payload.length) {
      return "not-a-file";
    }
  } catch (error) {
    return error.code ?? "NOT-PERSISTED";
  }
  return "created";
}

/**
 * Probe the real filesystem for the hazards a filesystem-derived route convention
 * inherits. Results are scoped to the platform that ran the harness; no claim is
 * made about platforms not measured.
 *
 * @param {string[]} candidatePaths
 * @returns {Promise<object>}
 */
async function probeFilesystem(candidatePaths) {
  const base = await mkdtemp(path.join(tmpdir(), "nusajs-route-spike-"));
  const probe = {
    platform: process.platform,
    createdPaths: 0,
    rejectedPaths: [],
    caseInsensitive: null,
    unicodeFolding: null,
    reservedDeviceNames: []
  };

  try {
    for (const candidate of candidatePaths) {
      const outcome = await writeProbeFile(path.join(base, "tree", candidate));
      if (outcome === "created") {
        probe.createdPaths += 1;
      } else {
        probe.rejectedPaths.push({ path: candidate, code: outcome });
      }
    }

    const caseDir = path.join(base, "case");
    await mkdir(caseDir, { recursive: true });
    await writeFile(path.join(caseDir, "Blog.page.tsx"), "// probe\n", "utf8");
    await writeFile(path.join(caseDir, "blog.page.tsx"), "// probe\n", "utf8");
    probe.caseInsensitive = (await readdir(caseDir)).length === 1;

    const unicodeDir = path.join(base, "unicode");
    await mkdir(unicodeDir, { recursive: true });
    await writeFile(path.join(unicodeDir, "caf\u00e9.page.tsx"), "// probe\n", "utf8");
    await writeFile(path.join(unicodeDir, "cafe\u0301.page.tsx"), "// probe\n", "utf8");
    probe.unicodeFolding = (await readdir(unicodeDir)).length === 1;

    const deviceDir = path.join(base, "device");
    await mkdir(deviceDir, { recursive: true });
    for (const name of ["con", "nul", "aux", "prn", "com1"]) {
      probe.reservedDeviceNames.push({
        name,
        asSuffixFile: await writeProbeFile(path.join(deviceDir, `${name}.page.tsx`)),
        asBareName: await writeProbeFile(path.join(deviceDir, "bare", name)),
        asRouteFolder: await writeProbeFile(path.join(deviceDir, name, "page.tsx"))
      });
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }

  return probe;
}

// ---------------------------------------------------------------------------
// Route-module API analysis (ADR-004).
// ---------------------------------------------------------------------------

/**
 * Read a fixture as a TypeScript source file. No module is executed and no program
 * is created, which is exactly the constraint docs/06_COMPILER_AND_DEV_SERVER.md
 * places on the compiler.
 *
 * @param {string} fileName
 * @returns {Promise<ts.SourceFile>}
 */
async function parseFixture(fileName) {
  const source = await readFile(path.join(moduleApiDir, fileName), "utf8");
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TS);
}

/**
 * Map local identifiers to the import they came from, so a call-based API can be
 * recognised through an alias.
 *
 * @param {ts.SourceFile} sourceFile
 * @returns {Map<string, { module: string, imported: string }>}
 */
function importBindings(sourceFile) {
  const bindings = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      continue;
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const moduleName = statement.moduleSpecifier.text;
    const named = statement.importClause.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const element of named.elements) {
        bindings.set(element.name.text, {
          module: moduleName,
          imported: (element.propertyName ?? element.name).text
        });
      }
    }
  }
  return bindings;
}

/** True when an expression is built only from literals, so it can be read as data. */
function isAnalyzableInitializer(node) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isBigIntLiteral(node)) {
    return true;
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return true;
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return true;
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.every(isAnalyzableInitializer);
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every((property) => {
      if (ts.isMethodDeclaration(property)) {
        return true;
      }
      if (!ts.isPropertyAssignment(property)) {
        return false;
      }
      return isAnalyzableInitializer(property.initializer);
    });
  }
  return false;
}

/** Names of the configuration keys the harness expects to recover. */
const EXPECTED_CONFIG_KEYS = ["runtime", "rendering"];

function objectKeys(node) {
  if (!ts.isObjectLiteralExpression(node)) {
    return [];
  }
  return node.properties
    .map((property) => {
      const name = property.name;
      if (!name) {
        return null;
      }
      if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
        return name.text;
      }
      return null;
    })
    .filter((name) => name !== null);
}

/**
 * Named-exports analyzer. One pass over the top-level statements; no cross-module
 * resolution and no callee identity question.
 *
 * @param {ts.SourceFile} sourceFile
 */
function analyzeNamedExports(sourceFile) {
  let steps = 0;
  for (const statement of sourceFile.statements) {
    steps += 1;
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    );
    if (!exported) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      steps += 1;
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "route") {
        continue;
      }
      const initializer = declaration.initializer;
      if (!initializer) {
        continue;
      }
      if (!isAnalyzableInitializer(initializer)) {
        return { outcome: "diagnostic", steps, keys: [], crossModule: false };
      }
      return {
        outcome: "read",
        steps,
        keys: objectKeys(initializer),
        crossModule: false
      };
    }
  }
  return { outcome: "not-found", steps, keys: [], crossModule: false };
}

/** Default export call expression, if any. */
function defaultExportCall(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && ts.isCallExpression(statement.expression)) {
      return statement.expression;
    }
  }
  return null;
}

/**
 * Naive call-based analyzer: matches the callee by name only. Included to show what
 * a name-only implementation silently misses.
 */
function analyzeDefinePageNaive(sourceFile) {
  let steps = 0;
  const call = defaultExportCall(sourceFile);
  steps += sourceFile.statements.length;
  if (!call) {
    return { outcome: "not-found", steps, keys: [], crossModule: false };
  }
  steps += 1;
  if (!ts.isIdentifier(call.expression) || call.expression.text !== "definePage") {
    return { outcome: "not-found", steps, keys: [], crossModule: false };
  }
  const argument = call.arguments[0];
  steps += 1;
  if (!argument || !isAnalyzableInitializer(argument)) {
    return { outcome: "diagnostic", steps, keys: [], crossModule: false };
  }
  return { outcome: "read", steps, keys: objectKeys(argument), crossModule: false };
}

/**
 * Binding-resolving call-based analyzer: resolves the callee identifier back to the
 * framework import before trusting it.
 */
function analyzeDefinePageResolved(sourceFile) {
  let steps = 0;
  const bindings = importBindings(sourceFile);
  steps += sourceFile.statements.length;
  const call = defaultExportCall(sourceFile);
  steps += 1;
  if (!call || !ts.isIdentifier(call.expression)) {
    return { outcome: "not-found", steps, keys: [], crossModule: true };
  }
  const binding = bindings.get(call.expression.text);
  steps += 1;
  if (!binding || binding.module !== "@nusajs/core" || binding.imported !== "definePage") {
    return { outcome: "not-found", steps, keys: [], crossModule: true };
  }
  const argument = call.arguments[0];
  steps += 1;
  if (!argument || !isAnalyzableInitializer(argument)) {
    return { outcome: "diagnostic", steps, keys: [], crossModule: true };
  }
  return { outcome: "read", steps, keys: objectKeys(argument), crossModule: true };
}

// ---------------------------------------------------------------------------
// Measurement.
// ---------------------------------------------------------------------------

function measureConvention(convention) {
  const spellings = LOGICAL_ROUTES.map((route) => ({
    route,
    paths: convention.spellings(route)
  }));

  for (const entry of spellings) {
    demand(
      entry.paths.length > 0,
      `${convention.id}: cannot spell logical route ${entry.route.id}`
    );
  }

  const boundaries = LOGICAL_BOUNDARIES.map((boundary) => ({
    boundary,
    path: convention.spellBoundary(boundary)
  }));
  for (const entry of boundaries) {
    demand(
      typeof entry.path === "string" && entry.path.length > 0,
      `${convention.id}: cannot spell boundary ${entry.boundary.id}`
    );
  }

  const aliasCounts = spellings.map((entry) => entry.paths.length);
  const canonicalEntries = spellings.map((entry) => ({
    file: entry.paths[0],
    pattern: entry.route.pattern
  }));

  const collisionResults = COLLISION_CASES.map((testCase) => {
    const entries = testCase.routes.map((route, index) => {
      const spelled = convention.spellings({
        id: `${testCase.id}-${index}`,
        pattern: route.pattern,
        kind: route.kind,
        group: route.variant === "grouped" ? "marketing" : null,
        segments: []
      });
      const chosen = route.variant === "nested" ? (spelled[1] ?? spelled[0]) : spelled[0];
      return { file: chosen, pattern: route.pattern };
    });
    const distinctFiles = new Set(entries.map((entry) => entry.file));
    const expressible = distinctFiles.size === entries.length;
    // When the convention collapses both routes onto one path, the filesystem itself
    // prevents the duplicate: the second file overwrites the first. That is a
    // different outcome from a reported conflict and must not be scored as detection.
    const conflicts = expressible ? detectCollisions(entries) : [];
    const namedFiles = new Set(conflicts.flatMap((conflict) => conflict.files));
    const allNamed = entries.every((entry) => namedFiles.has(entry.file));

    return {
      id: testCase.id,
      reason: testCase.reason,
      expressibleAsDistinctFiles: expressible,
      preventedByFilesystem: !expressible,
      detected: conflicts.length > 0,
      allConflictingFilesNamed: expressible ? allNamed : true,
      conflicts
    };
  });

  for (const result of collisionResults) {
    demand(
      result.detected || !result.expressibleAsDistinctFiles,
      `${convention.id}: collision case ${result.id} produced two files but no conflict report`
    );
    demand(
      result.allConflictingFilesNamed,
      `${convention.id}: collision case ${result.id} did not name every conflicting file`
    );
  }

  const ties = precedenceTies(LOGICAL_ROUTES);

  return {
    id: convention.id,
    title: convention.title,
    reservedNameCount: convention.reserved.length,
    reservedNames: convention.reserved,
    groupAliasing: convention.groupAliasing,
    precedenceSource: convention.precedenceSource,
    maxSpellingsPerUrl: Math.max(...aliasCounts),
    totalSpellings: aliasCounts.reduce((sum, count) => sum + count, 0),
    routeCount: LOGICAL_ROUTES.length,
    filesystemDerived: convention.id !== "manifest",
    collisionCases: collisionResults,
    precedenceTies: ties,
    canonicalPaths: canonicalEntries.map((entry) => entry.file).sort(),
    boundaryPaths: boundaries.map((entry) => entry.path).sort()
  };
}

async function measureModuleApis() {
  const fixtures = {
    namedExports: await parseFixture("named-exports.ts"),
    namedExportsDynamic: await parseFixture("named-exports-dynamic.ts"),
    definePage: await parseFixture("define-page.ts"),
    definePageAliased: await parseFixture("define-page-aliased.ts")
  };

  const namedExportsResult = analyzeNamedExports(fixtures.namedExports);
  const namedExportsDynamicResult = analyzeNamedExports(fixtures.namedExportsDynamic);
  const definePageNaive = analyzeDefinePageNaive(fixtures.definePage);
  const definePageNaiveAliased = analyzeDefinePageNaive(fixtures.definePageAliased);
  const definePageResolved = analyzeDefinePageResolved(fixtures.definePage);
  const definePageResolvedAliased = analyzeDefinePageResolved(fixtures.definePageAliased);

  demand(
    namedExportsResult.outcome === "read",
    "named exports: configuration was not readable without execution"
  );
  demand(
    EXPECTED_CONFIG_KEYS.every((key) => namedExportsResult.keys.includes(key)),
    "named exports: recovered configuration is missing an expected key"
  );
  demand(
    namedExportsDynamicResult.outcome === "diagnostic",
    "named exports: a computed initialiser did not produce a diagnostic"
  );
  demand(
    definePageResolved.outcome === "read",
    "definePage: configuration was not readable without execution"
  );
  demand(
    definePageResolvedAliased.outcome === "read",
    "definePage: aliased import defeated the binding-resolving analyzer"
  );
  demand(
    definePageNaiveAliased.outcome === "not-found",
    "definePage: the naive analyzer unexpectedly matched the aliased import"
  );

  return {
    namedExports: {
      literal: namedExportsResult,
      computed: namedExportsDynamicResult,
      crossModuleResolutionRequired: false,
      silentMissWithNaiveMatcher: false
    },
    definePage: {
      literalNaive: definePageNaive,
      aliasedNaive: definePageNaiveAliased,
      literalResolved: definePageResolved,
      aliasedResolved: definePageResolvedAliased,
      crossModuleResolutionRequired: true,
      silentMissWithNaiveMatcher: definePageNaiveAliased.outcome !== "read"
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Route convention and module API measurements");
  lines.push("");
  lines.push(`- Task: FW-004. Feeds ADR-003 and ADR-004.`);
  lines.push(`- Harness: \`spikes/route-convention/measure.mjs\`.`);
  lines.push(
    `- Node: \`${report.environment.node}\`. Platform: \`${report.environment.platform}\`.`
  );
  lines.push(`- TypeScript: \`${report.environment.typescript}\`.`);
  lines.push(
    `- Logical route set: ${report.logicalRoutes} routes, ${report.logicalBoundaries} boundaries, ${report.collisionCases} collision cases.`
  );
  lines.push("");
  lines.push("## Filesystem conventions");
  lines.push("");
  lines.push(
    "| Convention | Reserved names | Spellings per URL (max) | Total spellings | Group aliasing | Precedence source | Collisions reported | Unexpressible by construction | All conflicting files named |"
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const convention of report.conventions) {
    const detected = convention.collisionCases.filter((entry) => entry.detected).length;
    const expressible = convention.collisionCases.filter(
      (entry) => entry.expressibleAsDistinctFiles
    ).length;
    const prevented = convention.collisionCases.filter(
      (entry) => entry.preventedByFilesystem
    ).length;
    const named = convention.collisionCases.every((entry) => entry.allConflictingFilesNamed);
    lines.push(
      `| \`${convention.id}\` | ${convention.reservedNameCount} | ${convention.maxSpellingsPerUrl} | ${convention.totalSpellings} | ${convention.groupAliasing ? "yes" : "no"} | ${convention.precedenceSource} | ${detected} of ${expressible} | ${prevented} | ${named ? "yes" : "no"} |`
    );
  }
  lines.push("");
  lines.push(
    "`Unexpressible by construction` counts fixture collision cases the convention cannot"
  );
  lines.push("even write down, because both routes resolve to the same single path. That is an");
  lines.push("absence of an aliasing surface, not a missed detection: the case never reaches the");
  lines.push("scanner. Cases that *are* expressible must all be reported.");
  lines.push("");
  for (const convention of report.conventions) {
    for (const entry of convention.collisionCases) {
      if (entry.preventedByFilesystem) {
        lines.push(`- \`${convention.id}\`: \`${entry.id}\` — ${entry.reason} — unexpressible.`);
      }
    }
  }
  lines.push("");
  lines.push("### Precedence");
  lines.push("");
  for (const convention of report.conventions) {
    const ties = convention.precedenceTies;
    lines.push(
      ties.length === 0
        ? `- \`${convention.id}\`: 0 overlapping pattern pairs tie on specificity, so precedence is decidable from the patterns alone.`
        : `- \`${convention.id}\`: ${ties.length} overlapping pair(s) tie on specificity and would need enumeration order: ${ties.map((pair) => `\`${pair[0]}\` vs \`${pair[1]}\``).join(", ")}.`
    );
  }
  lines.push("");
  lines.push("## Cross-platform filesystem probe");
  lines.push("");
  lines.push(`Measured on \`${report.filesystem.platform}\` only. No claim is made about`);
  lines.push("platforms this run did not touch.");
  lines.push("");
  lines.push(`- Candidate paths created: ${report.filesystem.createdPaths}.`);
  lines.push(`- Paths rejected by the filesystem: ${report.filesystem.rejectedPaths.length}.`);
  lines.push(`- Case-insensitive path resolution: ${report.filesystem.caseInsensitive}.`);
  lines.push(`- Unicode NFC/NFD folded to one entry: ${report.filesystem.unicodeFolding}.`);
  lines.push("");
  lines.push("| Reserved device name | As suffix file | As bare segment | As route folder |");
  lines.push("| --- | --- | --- | --- |");
  for (const record of report.filesystem.reservedDeviceNames) {
    lines.push(
      `| \`${record.name}\` | ${record.asSuffixFile} | ${record.asBareName} | ${record.asRouteFolder} |`
    );
  }
  lines.push("");
  lines.push("## Route-module API");
  lines.push("");
  lines.push(
    "| Candidate | Literal config read without execution | Computed config produces diagnostic | Cross-module binding resolution required | Silent miss with a name-only matcher | Analyzer steps |"
  );
  lines.push("| --- | --- | --- | --- | --- | --- |");
  const named = report.moduleApis.namedExports;
  lines.push(
    `| named exports | ${named.literal.outcome === "read"} | ${named.computed.outcome === "diagnostic"} | ${named.crossModuleResolutionRequired} | ${named.silentMissWithNaiveMatcher} | ${named.literal.steps} |`
  );
  const define = report.moduleApis.definePage;
  lines.push(
    `| \`definePage()\` | ${define.literalResolved.outcome === "read"} | ${define.aliasedResolved.outcome === "read"} (alias resolved) | ${define.crossModuleResolutionRequired} | ${define.silentMissWithNaiveMatcher} | ${define.literalResolved.steps} |`
  );
  lines.push("");
  lines.push("## Honesty notes");
  lines.push("");
  lines.push(
    "- The counts above are structural, deterministic, and reproduce exactly on identical inputs."
  );
  lines.push(
    "- Filesystem probe results are platform-specific and must be re-run per platform before being cited for that platform."
  );
  lines.push(
    "- No performance claim is made here. Match-time budgets belong to FW-106 and the AC-ROUTE-06 fixture."
  );
  lines.push("");
  return lines.join("\n");
}

async function main() {
  log("measuring filesystem conventions");
  const conventions = CONVENTIONS.map(measureConvention);

  log("probing the real filesystem");
  const candidatePaths = [
    ...new Set(
      CONVENTIONS.filter((convention) => convention.id !== "manifest").flatMap((convention) =>
        LOGICAL_ROUTES.flatMap((route) =>
          convention.spellings(route).map((spelled) => `${convention.id}/${spelled}`)
        )
      )
    )
  ];
  const filesystem = await probeFilesystem(candidatePaths);
  demand(
    filesystem.createdPaths > 0,
    "filesystem probe created no paths at all; the measurement is not trustworthy"
  );

  log("analysing route-module APIs");
  const moduleApis = await measureModuleApis();

  const report = {
    task: "FW-004",
    generatedFor: ["ADR-003", "ADR-004"],
    environment: {
      node: process.version,
      platform: process.platform,
      typescript: ts.version
    },
    logicalRoutes: LOGICAL_ROUTES.length,
    logicalBoundaries: LOGICAL_BOUNDARIES.length,
    collisionCases: COLLISION_CASES.length,
    conventions,
    filesystem,
    moduleApis,
    failures
  };

  await mkdir(resultsDir, { recursive: true });
  await writeFile(
    path.join(resultsDir, "route-convention-comparison.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(resultsDir, "route-convention-comparison.md"),
    renderMarkdown(report),
    "utf8"
  );

  if (failures.length > 0) {
    for (const failure of failures) {
      log(`FAIL ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  log(`wrote ${resultsDir}`);
}

await main();
