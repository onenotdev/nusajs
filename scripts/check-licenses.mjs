/**
 * License gate for the workspace dependency tree.
 *
 * Reads the allow list out of `docs/SUPPLY_CHAIN_POLICY.md` section 5 so the
 * policy document and its enforcement cannot drift, then compares it against
 * the licenses pnpm reports for the installed tree.
 *
 * Exits 0 when every declared license is allowed or carries a recorded
 * exception, and exits 1 otherwise. Discharges the license half of pull-request
 * gate 8 in `docs/11_TESTING_AND_QUALITY.md` and part of `SEC-SUPPLY-002`.
 */

import { execFileSync, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

const repositoryRoot = join(dirname(new URL(import.meta.url).pathname.slice(1)), "..");
const policyPath = join(repositoryRoot, "docs/SUPPLY_CHAIN_POLICY.md");

/**
 * Parses the section 5 table into a map of license expression to disposition.
 *
 * @param {string} policy Contents of the supply-chain policy document.
 * @returns {Map<string, string>} Declared license expressions and dispositions.
 */
function readAllowList(policy) {
  const entries = new Map();

  for (const match of policy.matchAll(/^\| `([^`]+)` \| (allowed|exception: [^|]+) \|$/gm)) {
    entries.set(match[1].trim(), match[2].trim());
  }

  return entries;
}

/**
 * Collects the licenses of the installed tree from pnpm.
 *
 * @returns {Map<string, string[]>} License expression to package names.
 */
function readInstalledLicenses() {
  // Prefer the package-manager entry point that invoked this script, run
  // directly by the current Node binary: no shell, no argument concatenation.
  const execPath = process.env["npm_execpath"];
  const raw =
    execPath !== undefined && execPath.endsWith(".cjs")
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

const allowList = readAllowList(readFileSync(policyPath, "utf8"));

if (allowList.size === 0) {
  console.error("License gate: the allow list in docs/SUPPLY_CHAIN_POLICY.md section 5 is empty.");
  process.exit(1);
}

const installed = readInstalledLicenses();
const violations = [];

for (const [license, packages] of installed) {
  const disposition = allowList.get(license);

  if (disposition === undefined) {
    violations.push(`${license}: not in the allow list — ${packages.join(", ")}`);
  }
}

if (violations.length > 0) {
  console.error("License gate failed. See docs/SUPPLY_CHAIN_POLICY.md section 5.");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

const packageCount = [...installed.values()].reduce((total, list) => total + list.length, 0);
console.log(
  `License gate passed: ${packageCount} packages across ${installed.size} license expressions, ` +
    `all allowed by docs/SUPPLY_CHAIN_POLICY.md section 5.`
);
