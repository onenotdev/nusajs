import { builtinModules } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const nodeBuiltins = new Set(
  builtinModules.map((specifier) => specifier.replace(/^node:/, "").split("/")[0])
);

export const universalPackages = Object.freeze([
  Object.freeze({ name: "@nusajs/core", root: "packages/core" }),
  Object.freeze({ name: "@nusajs/renderer-preact", root: "packages/renderer-preact" })
]);

function extension(path) {
  const match = /(?:\.[^.\\/]+)$/.exec(path);
  return match?.[0] ?? "";
}

function isNodeBuiltin(specifier) {
  const normalized = specifier.replace(/^node:/, "");
  return nodeBuiltins.has(normalized.split("/")[0]);
}

function literalSpecifier(node) {
  return ts.isStringLiteralLike(node) ? node.text : undefined;
}

function collectSpecifiers(sourceText, file) {
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const specifiers = [];

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) {
        const specifier = literalSpecifier(node.moduleSpecifier);
        if (specifier !== undefined) specifiers.push(specifier);
      }
    } else if (ts.isImportTypeNode(node)) {
      const specifier = literalSpecifier(node.argument.literal);
      if (specifier !== undefined) specifiers.push(specifier);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const [argument] = node.arguments;
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if ((isDynamicImport || isRequire) && argument) {
        const specifier = literalSpecifier(argument);
        if (specifier !== undefined) specifiers.push(specifier);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.isFile() && sourceExtensions.has(extension(entry.name))) files.push(path);
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

export async function scanUniversalPackages(options = {}) {
  const root = resolve(options.repositoryRoot ?? repositoryRoot);
  const packages = options.packages ?? universalPackages;
  const violations = [];

  for (const packageEntry of packages) {
    const packageRoot = resolve(root, packageEntry.root);
    for (const tree of ["src", "dist"]) {
      for (const file of await filesUnder(resolve(packageRoot, tree))) {
        const source = await readFile(file, "utf8");
        for (const specifier of collectSpecifiers(source, file)) {
          if (!isNodeBuiltin(specifier)) continue;
          violations.push(
            Object.freeze({
              code: "NUSA_BOUNDARY_NODE_BUILTIN",
              package: packageEntry.name,
              file: relative(root, file).replaceAll("\\", "/"),
              specifier
            })
          );
        }
      }
    }
  }

  violations.sort(
    (left, right) =>
      left.file.localeCompare(right.file, "en") ||
      left.specifier.localeCompare(right.specifier, "en")
  );
  return Object.freeze(violations);
}

export function formatBoundaryViolation(violation) {
  return `${violation.code}: ${violation.package} imports ${JSON.stringify(violation.specifier)} in ${violation.file}`;
}

async function main() {
  const violations = await scanUniversalPackages();
  if (violations.length === 0) {
    console.log(`Universal boundary gate passed: ${universalPackages.length} packages scanned.`);
    return;
  }
  for (const violation of violations) console.error(formatBoundaryViolation(violation));
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
