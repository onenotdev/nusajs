import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..");

/**
 * Biome does not format markdown, so committed documents keep CRLF endings.
 * Every assertion below runs against normalized text.
 */
function readText(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

/** Collapses hard wraps so a quoted requirement can be matched as one string. */
function unwrap(document: string): string {
  return document.replace(/\s+/g, " ");
}

interface RootManifest {
  engines: { node: string };
  devDependencies: Record<string, string>;
}

const policy = readText("docs/SUPPORT_POLICY.md");
const adr = readText("docs/adr/ADR-006-supported-runtime-and-typescript-policy.md");
const workflow = readText(".github/workflows/ci.yml");
const checklist = readText("CHECKLIST.md");
const decisions = readText("docs/13_POSITIONING_RISKS_AND_DECISIONS.md");
const securityPrd = readText("docs/09_SECURITY_PRD.md");
const manifest = readJson<RootManifest>("package.json");
const baseTsconfig = readText("tsconfig.base.json");

const adrPath = "docs/adr/ADR-006-supported-runtime-and-typescript-policy.md";

/** The section 3.1 table, one row per Node line. */
interface NodeLineRow {
  line: string;
  major: number;
  status: string;
}

function parseNodeLines(): NodeLineRow[] {
  const rows: NodeLineRow[] = [];

  for (const match of policy.matchAll(
    /^\| (\d+)\.x \| [^|]* \| [^|]* \| [^|]* \| [^|]* \| ([^|]+) \|$/gm
  )) {
    const major = Number.parseInt(match[1] as string, 10);
    rows.push({
      line: `${major}.x`,
      major,
      status: (match[2] as string).trim()
    });
  }

  return rows;
}

/** The declared Node floor, read from the bolded sentence in section 3.1. */
function parseDeclaredFloor(): string {
  const match = /\*\*The floor is Node (\d+\.\d+\.\d+)\.\*\*/.exec(policy);

  return match === null ? "" : (match[1] as string);
}

/** The Node versions the tier-1 CI matrix actually runs. */
function parseWorkflowNodeVersions(): string[] {
  const match = /^\s*node: \[([^\]]+)\]$/m.exec(workflow);
  if (match === null) {
    return [];
  }

  return (match[1] as string)
    .split(",")
    .map((entry) => entry.trim().replace(/^"|"$/g, ""))
    .filter((entry) => entry.length > 0);
}

const nodeLines = parseNodeLines();
const declaredFloor = parseDeclaredFloor();
const workflowNodeVersions = parseWorkflowNodeVersions();

const checklistTaskIds = new Set(
  [...checklist.matchAll(/\*\*(FW-\d+) \[/g)].map((match) => match[1] as string)
);
const securityRequirementIds = new Set(
  [...securityPrd.matchAll(/^### (SEC-[A-Z]+-\d+) \[P\d\]/gm)].map((match) => match[1] as string)
);

describe("FW-005 supported runtime and TypeScript policy", () => {
  it("reads a non-empty policy table, floor, matrix, and identifier set", () => {
    // Guards every assertion below against silently passing on an empty parse.
    expect(nodeLines.length).toBeGreaterThan(0);
    expect(declaredFloor).not.toEqual("");
    expect(workflowNodeVersions.length).toBeGreaterThan(0);
    expect(checklistTaskIds.size).toBeGreaterThan(0);
    expect(securityRequirementIds.size).toBeGreaterThan(0);
  });

  it("declares the same Node floor in the policy and in engines.node", () => {
    // Commitment C2 of the ADR. This single assertion is why the task exists:
    // the floor, the CI matrix, and the table were three independent numbers
    // before FW-005, and one of them advertised an end-of-life runtime.
    expect(manifest.engines.node).toEqual(`>=${declaredFloor}`);
  });

  it("puts the floor on a Node line the policy marks supported", () => {
    const floorMajor = Number.parseInt(declaredFloor.split(".")[0] as string, 10);
    const row = nodeLines.find((entry) => entry.major === floorMajor);

    expect(row).toBeDefined();
    expect((row as NodeLineRow).status).toContain("Supported");
    expect((row as NodeLineRow).status).toContain("floor");
  });

  it("names exactly one primary Node line, and it is supported", () => {
    const primary = nodeLines.filter((entry) => entry.status.includes("primary"));

    expect(primary).toHaveLength(1);
    expect((primary[0] as NodeLineRow).status).toContain("Supported");
  });

  it("runs every supported Node major in the tier-1 CI matrix", () => {
    const supportedMajors = nodeLines
      .filter((entry) => entry.status.startsWith("Supported"))
      .map((entry) => entry.major);
    const matrixMajors = workflowNodeVersions.map((version) =>
      Number.parseInt(version.split(".")[0] as string, 10)
    );

    // Section 1 condition 1: supported means gated. A supported major absent
    // from the matrix is a support claim with no evidence behind it.
    const ungated = supportedMajors.filter((major) => !matrixMajors.includes(major));

    expect(supportedMajors.length).toBeGreaterThan(1);
    expect(ungated).toEqual([]);
  });

  it("does not run a Node major the policy marks unsupported", () => {
    const unsupportedMajors = nodeLines
      .filter((entry) => !entry.status.startsWith("Supported"))
      .map((entry) => entry.major);
    const matrixMajors = workflowNodeVersions.map((version) =>
      Number.parseInt(version.split(".")[0] as string, 10)
    );

    // Gating a line the policy calls end-of-life would produce a green result
    // for an unpatched runtime, which is evidence of the wrong thing.
    const gated = unsupportedMajors.filter((major) => matrixMajors.includes(major));

    expect(gated).toEqual([]);
  });

  it("exercises the floor at its exact minimum rather than at the major", () => {
    // A matrix entry of "22" resolves to the newest 22.x, which would never
    // exercise the minor the floor is pinned to.
    expect(workflowNodeVersions).toContain(declaredFloor);
  });

  it("keeps the TypeScript floor at or below the pinned compiler", () => {
    const floorMatch = /\*\*The floor is TypeScript (\d+)\.(\d+)\./.exec(policy);
    expect(floorMatch).not.toBeNull();

    const floorMajor = Number.parseInt((floorMatch as RegExpExecArray)[1] as string, 10);
    const floorMinor = Number.parseInt((floorMatch as RegExpExecArray)[2] as string, 10);

    const pinned = manifest.devDependencies["typescript"] as string;
    const pinnedParts = pinned.replace(/^[^\d]*/, "").split(".");
    const pinnedMajor = Number.parseInt(pinnedParts[0] as string, 10);
    const pinnedMinor = Number.parseInt(pinnedParts[1] as string, 10);

    expect(pinnedMajor).toBeGreaterThanOrEqual(floorMajor);
    if (pinnedMajor === floorMajor) {
      expect(pinnedMinor).toBeGreaterThanOrEqual(floorMinor);
    }
  });

  it("keeps the compiler options the TypeScript floor is derived from", () => {
    // The floor is 5.8 because erasableSyntaxOnly does not exist before it.
    // If that option is removed the derivation is void and the floor must be
    // recomputed rather than left standing as a stale claim.
    expect(baseTsconfig).toContain("erasableSyntaxOnly");
    expect(baseTsconfig).toContain("isolatedDeclarations");
    expect(policy).toContain("erasableSyntaxOnly");
  });

  it("keeps pre-release compiler testing incapable of blocking a merge", () => {
    // Commitment C7, and the "informational canary testing" line of
    // docs/11_TESTING_AND_QUALITY.md.
    expect(workflow).toContain("typescript@next");
    expect(workflow).toContain("continue-on-error: true");
    expect(unwrap(policy)).toContain("an informational failure does not block a merge");
  });

  it("records the governing decision as an accepted ADR", () => {
    expect(adr).toMatch(/^- Status: Accepted$/m);
    expect(adr).toMatch(/^- Date: \d{4}-\d{2}-\d{2}$/m);
    expect(adr).toMatch(/^- Security impact: (none|low|medium|high|critical)$/m);

    for (const heading of [
      "## Context",
      "## Decision drivers",
      "## Options",
      "## Decision",
      "## Consequences",
      "## Security analysis",
      "## Verification",
      "## Rollback or supersede plan"
    ]) {
      expect(adr).toContain(heading);
    }
  });

  it("compares at least three options before deciding", () => {
    const options = [...adr.matchAll(/^### Option [A-Z] — /gm)];

    // A single-option ADR is a rationalization, not a decision record.
    expect(options.length).toBeGreaterThanOrEqual(3);
  });

  it("agrees with the policy on the floor, the primary line, and the tiers", () => {
    expect(adr).toContain(declaredFloor);
    expect(adr).toContain("Node 24.x is the primary line");

    for (const runtime of ["Bun", "Deno"]) {
      expect(adr).toContain(runtime);
      expect(policy).toContain(runtime);
    }
  });

  it("links the policy and the ADR to each other", () => {
    expect(policy).toContain(adrPath);
    expect(adr).toContain("docs/SUPPORT_POLICY.md");
  });

  it("is registered in the decisions register in the accepted form", () => {
    expect(decisions).toMatch(
      /^- ADR-006: Supported runtime and TypeScript policy\. `Accepted` — `docs\/adr\/ADR-006-supported-runtime-and-typescript-policy\.md`\./m
    );
  });

  it("defers browser support to ADR-012 in both documents", () => {
    // The Node floor is a server-side statement. Inferring a client baseline
    // from it is the specific mistake section 8 exists to prevent.
    expect(policy).toContain("ADR-012");
    expect(adr).toContain("ADR-012");
  });

  it("does not claim to discharge a security requirement", () => {
    // A policy document implements no control, so under
    // docs/SECURITY_EVIDENCE_WORKFLOW.md section 3.2 it discharges nothing.
    expect(unwrap(policy)).toContain("no `SEC-*` requirement is discharged by this document");
    expect(policy).toContain("SEC-SUPPLY-002");
    expect(policy).toContain("SEC-SUPPLY-003");
  });

  it("does not publish an end-of-support window as a guarantee", () => {
    // docs/09_SECURITY_PRD.md section 24: "Do not publish target windows as
    // guarantees until the maintainer team can sustain them."
    const unwrapped = unwrap(policy);

    expect(unwrapped).toContain("target");
    expect(unwrapped).toContain("not a guarantee");
    expect(policy).toContain("FW-709");
  });

  it("states that no supported platform has been observed executing its gates", () => {
    // The most tempting overstatement in this task: growing a CI matrix is not
    // the same as having run it.
    expect(adr).toContain("AR-001");
    expect(unwrap(policy)).toContain("never been observed executing");
  });

  it("cites only checklist tasks that exist", () => {
    const unknown = new Set<string>();

    for (const source of [policy, adr]) {
      for (const match of source.matchAll(/FW-\d+/g)) {
        if (!checklistTaskIds.has(match[0])) {
          unknown.add(match[0]);
        }
      }
    }

    expect([...unknown]).toEqual([]);
  });

  it("cites only security requirements the security PRD declares", () => {
    const unknown = new Set<string>();

    for (const source of [policy, adr]) {
      for (const match of source.matchAll(/SEC-[A-Z]+-\d+/g)) {
        if (!securityRequirementIds.has(match[0])) {
          unknown.add(match[0]);
        }
      }
    }

    expect([...unknown]).toEqual([]);
  });

  it("is linked from the traceability matrix", () => {
    const traceability = readText("docs/14_REQUIREMENTS_TRACEABILITY.md");

    expect(traceability).toContain("SUPPORT_POLICY.md");
    expect(traceability).toContain("ADR-006-supported-runtime-and-typescript-policy.md");
    expect(traceability).toContain("tests/support-policy.test.ts");
  });

  it("names an owner for every manual gate it cannot mechanize", () => {
    // Section 9. A manual gate without a named authority is an unowned gate.
    for (const authority of ["Core maintainers", "Pull-request approver"]) {
      expect(policy).toContain(authority);
    }
  });
});
