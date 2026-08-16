import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..");

function readText(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

/**
 * A `SEC-*` requirement as declared by the normative security PRD.
 */
interface SecurityRequirement {
  id: string;
  priority: string;
}

/**
 * A row of the coverage table in the FW-008 approval record.
 */
interface CoverageRow {
  id: string;
  priority: string;
  owners: string;
  evidence: string;
  milestone: string;
}

const securityPrd = readText("docs/09_SECURITY_PRD.md");
const approvalRecord = readText("docs/SECURITY_THREAT_MODEL_APPROVAL.md");
const checklist = readText("CHECKLIST.md");

const requirements: SecurityRequirement[] = [
  ...securityPrd.matchAll(/^### (SEC-[A-Z]+-\d+) \[(P\d)\]/gm)
].map((match) => ({ id: match[1] as string, priority: match[2] as string }));

const coverageRows: CoverageRow[] = [
  ...approvalRecord.matchAll(/^\| (SEC-[A-Z]+-\d+) \| (P\d) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)
].map((match) => ({
  id: match[1] as string,
  priority: match[2] as string,
  owners: (match[3] as string).trim(),
  evidence: (match[4] as string).trim(),
  milestone: (match[5] as string).trim()
}));

const checklistTaskIds = new Set(
  [...checklist.matchAll(/^- \[.\] \*\*(FW-\d+) \[/gm)].map((match) => match[1] as string)
);

describe("security requirement coverage baseline (FW-008)", () => {
  it("reads a non-empty requirement set from the security PRD", () => {
    // If this fails, the PRD heading format changed and every assertion below
    // would silently pass against an empty set.
    expect(requirements.length).toBeGreaterThan(0);
    expect(coverageRows.length).toBeGreaterThan(0);
    expect(checklistTaskIds.size).toBeGreaterThan(0);
  });

  it("agrees with the requirement counts stated in the approval record", () => {
    const total = requirements.length;
    const p0Count = requirements.filter((requirement) => requirement.priority === "P0").length;
    const p1Count = requirements.filter((requirement) => requirement.priority === "P1").length;

    // The record states these numbers in prose; drift there is as misleading as
    // drift in the table.
    expect(approvalRecord).toContain(
      `**${total} requirements, ${p0Count} \`P0\` and ${p1Count} \`P1\`,`
    );
  });

  it("covers every requirement declared by the security PRD", () => {
    const covered = new Set(coverageRows.map((row) => row.id));
    const missing = requirements
      .map((requirement) => requirement.id)
      .filter((id) => !covered.has(id));

    // AC-SEC-01: every requirement must map to evidence, so an uncovered
    // requirement is a release blocker, not a documentation nit.
    expect(missing).toEqual([]);
  });

  it("does not cover requirements that the security PRD no longer declares", () => {
    const declared = new Set(requirements.map((requirement) => requirement.id));
    const stale = coverageRows.map((row) => row.id).filter((id) => !declared.has(id));

    expect(stale).toEqual([]);
  });

  it("records each requirement exactly once", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const row of coverageRows) {
      if (seen.has(row.id)) {
        duplicates.push(row.id);
      }
      seen.add(row.id);
    }

    expect(duplicates).toEqual([]);
  });

  it("repeats the priority assigned by the security PRD", () => {
    const priorities = new Map(
      requirements.map((requirement) => [requirement.id, requirement.priority])
    );
    const mismatched = coverageRows
      .filter((row) => priorities.get(row.id) !== row.priority)
      .map((row) => row.id);

    // A silently downgraded priority would weaken a release gate.
    expect(mismatched).toEqual([]);
  });

  it("names an owner and an evidence plan for every requirement", () => {
    const incomplete = coverageRows
      .filter((row) => row.owners.length === 0 || row.evidence.length === 0)
      .map((row) => row.id);

    expect(incomplete).toEqual([]);
  });

  it("uses only the evidence types permitted by the security PRD", () => {
    // Section 7 permits an automated test, a reproducible manual gate, or an
    // accepted risk. "conditional" marks a requirement scoped to an
    // integration that does not exist yet and is tracked as a finding.
    const permitted = [
      "automated test",
      "reproducible manual gate",
      "accepted risk",
      "conditional"
    ];
    const invalid = coverageRows
      .filter((row) => !permitted.some((type) => row.evidence.includes(type)))
      .map((row) => row.id);

    expect(invalid).toEqual([]);
  });

  it("references only checklist tasks that exist", () => {
    const unknown = new Set<string>();

    for (const row of coverageRows) {
      for (const match of `${row.owners} ${row.evidence}`.matchAll(/FW-\d+/g)) {
        const taskId = match[0];
        if (!checklistTaskIds.has(taskId)) {
          unknown.add(taskId);
        }
      }
    }

    // A coverage map pointing at a task that was never planned is not coverage.
    expect([...unknown]).toEqual([]);
  });

  it("gives every P0 requirement an owning task or an explicit gate owner", () => {
    const unowned = coverageRows
      .filter((row) => row.priority === "P0")
      .filter((row) => !/FW-\d+/.test(`${row.owners} ${row.evidence}`))
      .map((row) => row.id);

    // M0 exit criterion: no unowned P0 question.
    expect(unowned).toEqual([]);
  });

  it("keeps every unowned or conditional requirement linked to a recorded finding", () => {
    const findingIds = new Set(
      [...approvalRecord.matchAll(/^\| (F-\d+) \|/gm)].map((match) => match[1] as string)
    );

    expect(findingIds.size).toBeGreaterThan(0);

    const dangling = new Set<string>();

    for (const row of coverageRows) {
      const cell = `${row.owners} ${row.evidence}`;
      const needsFinding = cell.includes("none") || cell.includes("conditional");
      if (!needsFinding) {
        continue;
      }

      const referenced = [...cell.matchAll(/F-\d+/g)].map((match) => match[0]);
      if (referenced.length === 0) {
        // SEC-FILE-004 style rows may defer to the family finding, so require
        // at least one finding reference somewhere on the row.
        dangling.add(row.id);
        continue;
      }

      for (const id of referenced) {
        if (!findingIds.has(id)) {
          dangling.add(row.id);
        }
      }
    }

    expect([...dangling]).toEqual([]);
  });

  it("states the limits of the approval so it cannot be read as a release gate", () => {
    // Section 26 requires independent review before v1; a single approver
    // cannot satisfy it, and the record must say so.
    expect(approvalRecord).toContain("independent reviewer");
    expect(approvalRecord).toContain("FW-703");
    // FW-009 owns the ongoing workflow; FW-008 must not absorb it.
    expect(approvalRecord).toContain("FW-009");
  });

  it("is linked from the traceability matrix as security evidence", () => {
    const traceability = readText("docs/14_REQUIREMENTS_TRACEABILITY.md");

    expect(traceability).toContain("SECURITY_THREAT_MODEL_APPROVAL.md");
  });
});
