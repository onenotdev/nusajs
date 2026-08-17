/**
 * License gate for the workspace dependency tree.
 *
 * Compares licenses reported by pnpm against the repository's public allow
 * list. Policy and agent-governance documents are intentionally not required
 * by a fresh public checkout.
 *
 * Exits 0 when every declared license is allowed or carries a recorded
 * exception, and exits 1 otherwise.
 */

import { execFileSync, execSync } from "node:child_process";
import { dirname, join } from "node:path";
import process from "node:process";

const repositoryRoot = join(dirname(new URL(import.meta.url).pathname.slice(1)), "..");
const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
  "MIT OR Apache-2.0"
]);

/**
 * Collects the licenses of the installed tree from pnpm.
 *
 * @returns {Map<string, string[]>} License expression to package names.
 */
function readInstalledLicenses() {
  // Prefer the package-manager entry point that invoked this script, run
  // directly by the current Node binary: no shell, no argument concatenation.
  const execPath = process.env.npm_execpath;
  const raw = execPath?.endsWith(".cjs")
    ? execFileSync(process.execPath, [execPath, "licenses", "list", "--json"], {
        cwd: repositoryRoot,
        encoding: "utf8"
      })
    : // Standalone invocation. The command is a fixed literal with no
      // interpolated value, so a shell cannot be induced to run anything else.
      execSync("pnpm licenses list --json", {
        cwd: repositoryRoot,
        encoding: "utf8"
      });

  const start = raw.indexOf("{");
  if (start < 0) {
    throw new Error("pnpm licenses list produced no JSON document");
  }

  const parsed = JSON.parse(raw.slice(start));
  const grouped = new Map();

  for (const [license, packages] of Object.entries(parsed)) {
    grouped.set(
      license,
      packages.map((entry) => `${entry.name}@${(entry.versions ?? []).join(",")}`)
    );
  }

  return grouped;
}

const installed = readInstalledLicenses();
const violations = [];

for (const [license, packages] of installed) {
  if (!allowedLicenses.has(license)) {
    violations.push(`${license}: not in the allow list — ${packages.join(", ")}`);
  }
}

if (violations.length > 0) {
  console.error("License gate failed. Review the allow list in scripts/check-licenses.mjs.");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

const packageCount = [...installed.values()].reduce((total, list) => total + list.length, 0);
console.log(
  `License gate passed: ${packageCount} packages across ${installed.size} license expressions, ` +
    "all present in the repository allow list."
);
