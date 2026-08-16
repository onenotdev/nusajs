import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..");

function readText(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

/**
 * A record in the accepted-risk register.
 */
interface AcceptedRisk {
  id: string;
  fields: Map<string, string>;
}

/**
 * A row of the conditional-requirement registry in the workflow document.
 */
interface ConditionalRequirement {
  id: string;
  priority: string;
  trigger: string;
  absorbingTask: string;
  finding: string;
}

const workflow = readText("docs/SECURITY_EVIDENCE_WORKFLOW.md");
const register = readText("docs/SECURITY_ACCEPTED_RISKS.md");
const approvalRecord = readText("docs/SECURITY_THREAT_MODEL_APPROVAL.md");
const securityPrd = readText("docs/09_SECURITY_PRD.md");
const checklist = readText("CHECKLIST.md");

const requirementPriorities = new Map(
  [...securityPrd.matchAll(/^### (SEC-[A-Z]+-\d+) \[(P\d)\]/gm)].map((match) => [
    match[1] as string,
    match[2] as string
  ])
);

const checklistTaskIds = new Set(
  [...checklist.matchAll(/^- \[.\] \*\*(FW-\d+) \[/gm)].map((match) => match[1] as string)
);

const findingIds = new Set(
  [...approvalRecord.matchAll(/^\| (F-\d+) \|/gm)].map((match) => match[1] as string)
);

const coverageRows = [
  ...approvalRecord.matchAll(/^\| (SEC-[A-Z]+-\d+) \| (P\d) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)
].map((match) => ({
  id: match[1] as string,
  cell: `${(match[3] as string).trim()} ${(match[4] as string).trim()}`
}));

const conditionalRequirements: ConditionalRequirement[] = [
  ...workflow.matchAll(/^\| (SEC-[A-Z]+-\d+) \| (P\d) \| ([^|]+) \| ([^|]+) \| (F-\d+) \|$/gm)
].map((match) => ({
  id: match[1] as string,
  priority: match[2] as string,
  trigger: (match[3] as string).trim(),
  absorbingTask: (match[4] as string).trim(),
  finding: match[5] as string
}));

const dispositions = [...workflow.matchAll(/^\| (F-\d+) \| ([^|]+) \| ([A-Z]+) \|$/gm)].map(
  (match) => ({
    finding: match[1] as string,
    action: (match[2] as string).trim(),
    state: match[3] as string
  })
);

const acceptedRisks: AcceptedRisk[] = register
  .split(/^## AR-/m)
  .slice(1)
  .map((block) => {
    const id = `AR-${/^(\d+)/.exec(block)?.[1] ?? ""}`;
    const fields = new Map<string, string>(
      [...block.matchAll(/^- ([A-Z][A-Za-z ]+): (.*)$/gm)].map((match) => [
        (match[1] as string).trim(),
        (match[2] as string).trim()
      ])
    );
    return { id, fields };
  });

const mandatoryFields = [
  "Status",
  "Requirements",
  "Scope",
  "Rationale",
  "Compensating controls",
  "Owner",
  "Approved by",
  "Recorded",
  "Review by",
  "Remediation"
];

const permittedStatuses = ["PROPOSED", "ACCEPTED", "RENEWED", "RETIRED", "EXPIRED", "BREACHED"];

const permittedDispositionStates = ["RESOLVED", "SCHEDULED", "AMENDED"];

describe("security evidence and accepted-risk workflow (FW-009)", () => {
  it("reads a non-empty workflow, register, and requirement set", () => {
    // Guards every assertion below against silently passing on an empty parse.
    expect(requirementPriorities.size).toBeGreaterThan(0);
    expect(checklistTaskIds.size).toBeGreaterThan(0);
    expect(findingIds.size).toBeGreaterThan(0);
    expect(coverageRows.length).toBeGreaterThan(0);
    expect(conditionalRequirements.length).toBeGreaterThan(0);
    expect(dispositions.length).toBeGreaterThan(0);
    expect(acceptedRisks.length).toBeGreaterThan(0);
  });

  it("names every evidence type, gate tier, and release-index section", () => {
    // Section 7 of the security PRD permits exactly three evidence types.
    for (const type of ["automated test", "reproducible manual gate", "accepted risk"]) {
      expect(workflow).toContain(type);
    }

    // Section 26 defines four gate tiers; the workflow must bind to all of them.
    for (const tier of [
      "Pull-request gates",
      "Prerelease gates",
      "Release-candidate evidence index",
      "stable-release blocker policy"
    ]) {
      expect(workflow).toContain(tier);
    }

    // The eight artifact classes required by the traceability rule.
    for (const section of [
      "| Commit |",
      "| CI |",
      "| Conformance |",
      "| Benchmark |",
      "| Security |",
      "| API |",
      "| Documentation |",
      "| Design partner |"
    ]) {
      expect(workflow).toContain(section);
    }
  });

  it("gives every accepted-risk record a well-formed identifier", () => {
    const malformed = acceptedRisks.filter((risk) => !/^AR-\d{3}$/.test(risk.id)).map((r) => r.id);
    const duplicates = acceptedRisks
      .map((risk) => risk.id)
      .filter((id, index, all) => all.indexOf(id) !== index);

    expect(malformed).toEqual([]);
    expect(duplicates).toEqual([]);
  });

  it("populates every mandatory field of every accepted-risk record", () => {
    const incomplete: string[] = [];

    for (const risk of acceptedRisks) {
      for (const field of mandatoryFields) {
        const value = risk.fields.get(field);
        if (value === undefined || value.length === 0 || /^TBD$/i.test(value)) {
          incomplete.push(`${risk.id}: ${field}`);
        }
      }
    }

    // A record missing a field is not an accepted risk; it is an undocumented gap.
    expect(incomplete).toEqual([]);
  });

  it("uses only the permitted status vocabulary", () => {
    const invalid = acceptedRisks
      .filter((risk) => !permittedStatuses.includes(risk.fields.get("Status") ?? ""))
      .map((risk) => risk.id);

    expect(invalid).toEqual([]);
  });

  it("bounds every review-by date, milestone, or task predicate", () => {
    const openEnded = acceptedRisks
      .filter((risk) => {
        const value = risk.fields.get("Review by") ?? "";
        return !(
          /^\d{4}-\d{2}-\d{2}$/.test(value) ||
          /^M[0-7]$/.test(value) ||
          /^before FW-\d+ is marked DONE$/.test(value)
        );
      })
      .map((risk) => risk.id);

    // An open-ended accepted risk is how a requirement gets weakened silently.
    expect(openEnded).toEqual([]);
  });

  it("records only requirements that the security PRD declares, at the stated priority", () => {
    const problems: string[] = [];

    for (const risk of acceptedRisks) {
      const requirements = risk.fields.get("Requirements") ?? "";
      if (requirements === "process") {
        continue;
      }

      const cited = [...requirements.matchAll(/`(SEC-[A-Z]+-\d+)` \(`(P\d)`\)/g)];
      if (cited.length === 0) {
        problems.push(`${risk.id}: no requirement cited in the declared form`);
        continue;
      }

      for (const match of cited) {
        const id = match[1] as string;
        const priority = match[2] as string;
        const declared = requirementPriorities.get(id);
        if (declared === undefined) {
          problems.push(`${risk.id}: ${id} is not declared by the security PRD`);
        } else if (declared !== priority) {
          problems.push(`${risk.id}: ${id} is ${declared}, recorded as ${priority}`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("does not let an agent promote a P0 accepted risk", () => {
    // Section 6.3: a P0 record requires a named human maintainer approver, so an
    // agent-authored register may only carry it as PROPOSED.
    const promoted = acceptedRisks
      .filter((risk) => (risk.fields.get("Requirements") ?? "").includes("`P0`"))
      .filter((risk) => risk.fields.get("Status") === "ACCEPTED")
      .map((risk) => risk.id);

    expect(promoted).toEqual([]);
  });

  it("keeps every conditional requirement declared, P1, owned on activation, and linked to a finding", () => {
    const problems: string[] = [];

    for (const conditional of conditionalRequirements) {
      const declared = requirementPriorities.get(conditional.id);

      if (declared === undefined) {
        problems.push(`${conditional.id}: not declared by the security PRD`);
        continue;
      }
      if (declared !== conditional.priority) {
        problems.push(`${conditional.id}: is ${declared}, registered as ${conditional.priority}`);
      }
      // A conditional P0 requirement is not permitted; P0 needs a standing gate.
      if (declared !== "P1") {
        problems.push(`${conditional.id}: only a P1 requirement may be conditional`);
      }
      if (!findingIds.has(conditional.finding)) {
        problems.push(`${conditional.id}: cites unknown finding ${conditional.finding}`);
      }
      if (conditional.trigger.length === 0 || conditional.absorbingTask.length === 0) {
        problems.push(`${conditional.id}: missing an activation trigger or absorbing task`);
      }
    }

    expect(problems).toEqual([]);
  });

  it("registers every coverage-map row that is marked conditional", () => {
    const registered = new Set(conditionalRequirements.map((entry) => entry.id));
    const unregistered = coverageRows
      .filter((row) => row.cell.includes("conditional"))
      .map((row) => row.id)
      .filter((id) => !registered.has(id));

    // Otherwise "conditional" becomes a place for a requirement to hide.
    expect(unregistered).toEqual([]);
  });

  it("gives every recorded finding a disposition in a permitted state", () => {
    const dispositionStates = new Map(
      dispositions.map((disposition) => [disposition.finding, disposition.state])
    );

    const undisposed = [...findingIds].filter((id) => !dispositionStates.has(id));
    const invalidStates = [...dispositionStates.entries()]
      .filter(([, state]) => !permittedDispositionStates.includes(state))
      .map(([id, state]) => `${id}: ${state}`);

    expect(undisposed).toEqual([]);
    expect(invalidStates).toEqual([]);
  });

  it("references only checklist tasks that exist", () => {
    const unknown = new Set<string>();

    for (const source of [workflow, register]) {
      for (const match of source.matchAll(/FW-\d+/g)) {
        if (!checklistTaskIds.has(match[0])) {
          unknown.add(match[0]);
        }
      }
    }

    // A workflow that assigns work to a task nobody planned assigns nothing.
    expect([...unknown]).toEqual([]);
  });

  it("keeps the amendments to the approved FW-008 record recorded", () => {
    // Section 4 forbids editing the approved record silently.
    expect(approvalRecord).toContain("## 8. Amendments");
    expect(approvalRecord).toMatch(/^\| A-\d+ \| \d{4}-\d{2}-\d{2} \| FW-\d+ \|/m);
  });

  it("states the limits of its own authority", () => {
    // The workflow is procedural; it may not silently absorb FW-018, FW-019, or
    // the independent review that FW-703 owns.
    expect(workflow).toContain("FW-018");
    expect(workflow).toContain("FW-019");
    expect(workflow).toContain("FW-703");
    expect(workflow).toContain("Interpretation I-1");
  });

  it("is linked from the traceability matrix", () => {
    const traceability = readText("docs/14_REQUIREMENTS_TRACEABILITY.md");

    expect(traceability).toContain("SECURITY_EVIDENCE_WORKFLOW.md");
    expect(traceability).toContain("SECURITY_ACCEPTED_RISKS.md");
  });
});
