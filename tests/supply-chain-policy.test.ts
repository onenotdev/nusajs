import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Mechanical enforcement for `docs/SUPPLY_CHAIN_POLICY.md` (FW-019).
 *
 * The policy defines the dependency, license, provenance, and publishing gates
 * that `docs/09_SECURITY_PRD.md` section 26 and pull-request gate 8 of
 * `docs/11_TESTING_AND_QUALITY.md` require but do not define. These assertions
 * check the parts of that policy a machine can check: that every
 * `SEC-SUPPLY-*` requirement is addressed or explicitly reassigned, that the
 * gates it names exist as real commands in real workflow steps, and that the
 * trust boundary it records is present in every document that must carry it.
 *
 * What remains a judgement — whether a dependency's maintenance is adequate,
 * whether a transitive cost is proportionate — is listed as a manual gate in
 * the policy's section 11 and is deliberately not asserted here.
 */

const repositoryRoot = join(import.meta.dirname, "..");

function readText(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

/** A license expression declared by the policy's allow list. */
interface LicenseEntry {
  /** The SPDX expression exactly as the policy writes it. */
  readonly expression: string;
  /** Either `allowed` or an `exception: <reason>` disposition. */
  readonly disposition: string;
}

/** The subset of the root manifest these assertions depend on. */
interface RootManifest {
  /** npm script names mapped to their command lines. */
  readonly scripts: Record<string, string>;
}

const policy = readText("docs/SUPPLY_CHAIN_POLICY.md");
const securityPrd = readText("docs/09_SECURITY_PRD.md");
const approvalRecord = readText("docs/SECURITY_THREAT_MODEL_APPROVAL.md");
const evidenceWorkflow = readText("docs/SECURITY_EVIDENCE_WORKFLOW.md");
const workspaceFile = readText("pnpm-workspace.yaml");
const workflow = readText(".github/workflows/ci.yml");
const checklist = readText("CHECKLIST.md");
const manifest = JSON.parse(readText("package.json")) as RootManifest;

const supplyRequirements = new Map<string, string>(
  [...securityPrd.matchAll(/^### (SEC-SUPPLY-\d+) \[(P\d)\]/gm)].map((match) => [
    match[1] as string,
    match[2] as string
  ])
);

const licenseEntries: LicenseEntry[] = [
  ...policy.matchAll(/^\| `([^`]+)` \| (allowed|exception: [^|]+) \|$/gm)
].map((match) => ({
  expression: (match[1] as string).trim(),
  disposition: (match[2] as string).trim()
}));

const checklistTaskIds = new Set(
  [...checklist.matchAll(/^- \[.\] \*\*(FW-\d+) \[/gm)].map((match) => match[1] as string)
);

const referencedTaskIds = new Set([...policy.matchAll(/\bFW-\d{3}\b/g)].map((match) => match[0]));

/** The five review dimensions `SEC-SUPPLY-005` enumerates. */
const reviewDimensions = [
  "Maintenance",
  "Ownership",
  "Install and download script",
  "Transitive risk",
  "License"
];

/** Licenses measured in the installed tree when the policy was written. */
const measuredLicenses = [
  "MIT",
  "Apache-2.0",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "MIT OR Apache-2.0"
];

describe("supply-chain, license, provenance, and publishing policy (FW-019)", () => {
  it("reads a non-empty policy, requirement set, and checklist", () => {
    // Guards every assertion below against silently passing on an empty parse.
    expect(policy.length).toBeGreaterThan(0);
    expect(supplyRequirements.size).toBeGreaterThan(0);
    expect(licenseEntries.length).toBeGreaterThan(0);
    expect(checklistTaskIds.size).toBeGreaterThan(0);
    expect(referencedTaskIds.size).toBeGreaterThan(0);
  });

  it("addresses every supply-chain requirement the security PRD declares", () => {
    const unaddressed = [...supplyRequirements.keys()].filter((id) => !policy.includes(id));

    // A requirement the policy neither implements nor reassigns to a named task
    // is an unowned P0 or P1, which docs/12_ROADMAP_AND_RELEASES.md forbids at a
    // milestone exit.
    expect(unaddressed).toEqual([]);
  });

  it("records all five dependency review dimensions", () => {
    const missing = reviewDimensions.filter((dimension) => !policy.includes(`| ${dimension} |`));

    // SEC-SUPPLY-005 enumerates maintenance, ownership, download script,
    // transitive risk, and license. Dropping one silently narrows the review.
    expect(missing).toEqual([]);
  });

  it("requires explicit approval before any install script runs", () => {
    expect(policy).toContain("Install scripts are denied by default");
    expect(policy).toContain("allowBuilds");

    // The deny-by-default state must actually hold, not merely be described.
    expect(workspaceFile).toContain("allowBuilds:");
    expect(workspaceFile).not.toMatch(/^\s+\S+: true$/m);
  });

  it("allows every license present in the measured dependency tree", () => {
    const allowed = new Set(
      licenseEntries.filter((entry) => entry.disposition === "allowed").map((e) => e.expression)
    );
    const uncovered = measuredLicenses.filter((license) => !allowed.has(license));

    expect(uncovered).toEqual([]);
  });

  it("denies copyleft licenses for distributed code", () => {
    for (const denied of ["`GPL-*`", "`AGPL-*`", "`LGPL-*`", "`UNLICENSED`"]) {
      expect(policy).toContain(denied);
    }
  });

  it("defines a critical dependency finding and what makes it new", () => {
    // Section 26 of the security PRD requires "No new critical dependency
    // finding" without defining either word. An undefined gate cannot fail.
    expect(policy).toContain("**critical dependency finding**");
    expect(policy).toMatch(/\*\*New\*\* means/);
    expect(policy).toContain("merge base");

    // The honest part: a dev-only critical still blocks, and unreachability is
    // not a waiver at the critical tier.
    expect(policy).toContain("Development-only advisories are in scope");
  });

  it("states a failure action that does not weaken the gate", () => {
    expect(policy).toContain("the pull request does not merge");
    expect(policy).toContain(
      "Suppressing an advisory, lowering `--audit-level`, or passing `--no-optional`"
    );
  });

  it("wires every named scanner into both the manifest and continuous integration", () => {
    const requiredScripts = ["deps:audit", "deps:licenses", "deps:check"];
    const missingScripts = requiredScripts.filter(
      (name) => (manifest.scripts[name] ?? "").length === 0
    );

    expect(missingScripts).toEqual([]);

    // The same commands must run locally and in CI, as ADR-005 requires.
    for (const command of ["pnpm run deps:audit", "pnpm run deps:licenses"]) {
      expect(workflow).toContain(command);
      expect(policy).toContain(command);
    }

    // And the aggregate local gate must include them, so a developer cannot
    // pass `verify` while CI would fail.
    expect(manifest.scripts["verify"]).toContain("pnpm run deps:check");
  });

  it("keeps the license gate readable from the policy itself", () => {
    // scripts/check-licenses.mjs parses the section 5 table, so the policy and
    // its enforcement cannot drift apart.
    const checker = readText("scripts/check-licenses.mjs");

    expect(policy).toContain("scripts/check-licenses.mjs");
    expect(checker).toContain("docs/SUPPLY_CHAIN_POLICY.md");
  });

  it("specifies the publish dry run as a complete reproducible manual gate", () => {
    // Section 3.1 of the evidence workflow admits a manual gate only with named
    // steps, an expected observation, an executing role, and a stored artifact.
    for (const element of [
      "**Executing role:**",
      "**Steps:**",
      "**Expected observation:**",
      "**Artifact:**",
      "**Failure action:**"
    ]) {
      expect(policy).toContain(element);
    }

    expect(policy).toContain("--dry-run");
    expect(policy).toContain("--provenance");
  });

  it("records the release-artifact trust boundary in every document that carries it", () => {
    const boundary = "| Release artifact to consuming application |";

    // The boundary table of the security PRD, section 6.
    expect(securityPrd).toContain(boundary);
    // And the policy, which explains why the row belongs there.
    expect(policy).toContain(boundary);

    for (const control of [
      "provenance attestation",
      "package-content review",
      "lockfile integrity",
      "no install scripts"
    ]) {
      expect(securityPrd).toContain(control);
    }
  });

  it("closes FW-008 finding F-2 through a recorded amendment", () => {
    // Section 4 of the evidence workflow forbids changing the approved record
    // silently; section 8 requires every finding to carry a disposition state.
    expect(approvalRecord).toContain("| A-2 | 2026-08-16 | FW-019 |");
    expect(approvalRecord).toContain("**Resolved by amendment A-2:");
    expect(evidenceWorkflow).toMatch(/^\| F-2 \|.*\| RESOLVED \|$/m);
  });

  it("disposes of the accepted risk whose review-by date this task reached", () => {
    const register = readText("docs/SECURITY_ACCEPTED_RISKS.md");
    const block = register.split(/^## AR-/m)[1] ?? "";

    // Section 6.4 permits exactly retire, renew, or escalate. Anything else
    // makes the record EXPIRED, which is a release blocker.
    expect(block).toMatch(/^- Status: (RETIRED|RENEWED|ACCEPTED|BREACHED)$/m);
    expect(block).toContain("Renewed: 2026-08-16 by FW-019");

    // And a renewed record may not still point at the task that renewed it.
    expect(block).not.toContain("Review by: before FW-019 is marked DONE");
  });

  it("names the owning task for everything it declares out of scope", () => {
    // Secret scanning, plugin declarations, strict mode, the public reporting
    // policy, and the independent review are all adjacent to this policy and
    // none of them is discharged by it.
    for (const owner of ["FW-018", "FW-120", "FW-601", "FW-602", "FW-603", "FW-703", "FW-709"]) {
      expect(policy).toContain(owner);
    }

    // The secret-scanning gate must be specified without being claimed.
    expect(policy).toContain("No secret scanner runs in this repository today");
  });

  it("refers only to checklist tasks that exist", () => {
    const unknown = [...referencedTaskIds].filter((id) => !checklistTaskIds.has(id));

    expect(unknown).toEqual([]);
  });

  it("does not claim that an unexecuted gate is evidence", () => {
    // The single most tempting overstatement in this task: wiring a workflow
    // step is not the same as a gate that has ever blocked a merge.
    expect(policy).toContain("never executed");
    expect(policy).toContain("`AR-001`");
  });
});
