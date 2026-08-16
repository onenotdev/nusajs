import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Mechanical enforcement for `docs/STRICT_SECURITY_MODE.md` (FW-018).
 *
 * The policy defines what `docs/00_MASTER_PRD.md` NFR-011 and
 * `docs/09_SECURITY_PRD.md` objective SO-04 require but do not define: what
 * fail-closed means, which relaxations of a security control are legitimate,
 * and what severity a security diagnostic carries. These assertions check the
 * parts a machine can check: that every declared rule reaches the decision
 * table, that every escape hatch names a requirement whose normative text
 * actually permits an exception at the priority quoted, that every owner and
 * every `FW-` reference exists, and that the proposed ADR-008 is wired into the
 * reserved-decision list without being treated as accepted authority.
 *
 * What remains a judgement — whether a given control's failure mode is truly
 * closed, whether a new relaxation belongs in the inventory — is listed as a
 * manual gate in the policy's section 9 and is deliberately not asserted here.
 */

const repositoryRoot = join(import.meta.dirname, "..");

function readText(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

/** One row of the escape-hatch inventory in section 5 of the policy. */
interface EscapeHatch {
  /** The `SEC-*` requirement that permits the relaxation. */
  readonly requirement: string;
  /** The priority the policy quotes for that requirement. */
  readonly priority: string;
  /** What may be relaxed. */
  readonly subject: string;
  /** The required form of the explicit opt-in. */
  readonly optIn: string;
  /** The diagnostic, manifest entry, or approval the relaxation must produce. */
  readonly diagnostic: string;
  /** The checklist task that owns the control. */
  readonly owner: string;
}

const policy = readText("docs/STRICT_SECURITY_MODE.md");
const adr = readText("docs/adr/ADR-008-security-manifest-and-strict-mode.md");
const securityPrd = readText("docs/09_SECURITY_PRD.md");
const masterPrd = readText("docs/00_MASTER_PRD.md");
const decisions = readText("docs/13_POSITIONING_RISKS_AND_DECISIONS.md");
const approvalRecord = readText("docs/SECURITY_THREAT_MODEL_APPROVAL.md");
const evidenceWorkflow = readText("docs/SECURITY_EVIDENCE_WORKFLOW.md");
const traceability = readText("docs/14_REQUIREMENTS_TRACEABILITY.md");
const glossary = readText("docs/GLOSSARY.md");
const observability = readText("docs/08_DX_AND_OBSERVABILITY.md");
const compiler = readText("docs/06_COMPILER_AND_DEV_SERVER.md");
const checklist = readText("CHECKLIST.md");

const checklistTaskIds = new Set(
  [...checklist.matchAll(/\*\*(FW-\d+) \[/g)].map((match) => match[1] as string)
);

/** Every `SEC-*` requirement in the security PRD, mapped to its priority. */
const requirementPriorities = new Map<string, string>(
  [...securityPrd.matchAll(/^### (SEC-[A-Z]+-\d+) \[(P\d)\]/gm)].map((match) => [
    match[1] as string,
    match[2] as string
  ])
);

/** Every `SEC-*` requirement, mapped to its normative body text. */
const requirementBodies = new Map<string, string>(
  securityPrd
    .split(/^### /m)
    .slice(1)
    .flatMap((section) => {
      const heading = section.match(/^(SEC-[A-Z]+-\d+) \[P\d\]/);
      if (heading === null) {
        return [];
      }
      const body = section.split(/^## /m)[0] as string;
      return [[heading[1] as string, body] as const];
    })
);

const escapeHatches: readonly EscapeHatch[] = [
  ...policy.matchAll(
    /^\| (SEC-[A-Z]+-\d+) \| (P\d) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| (FW-\d+) \|$/gm
  )
].map((match) => ({
  requirement: match[1] as string,
  priority: match[2] as string,
  subject: (match[3] as string).trim(),
  optIn: (match[4] as string).trim(),
  diagnostic: (match[5] as string).trim(),
  owner: match[6] as string
}));

/** Rule identifiers declared as bold headings in section 4. */
const declaredRules = [...policy.matchAll(/^\*\*(FC-\d+) — /gm)].map((match) => match[1] as string);

/** Rule identifiers cited by the section 4.1 decision table. */
const citedRules = new Set(
  [...policy.matchAll(/^\|[^|]+\|[^|]+\| (FC-\d+) \|$/gm)].map((match) => match[1] as string)
);

describe("strict security mode and fail-closed policy", () => {
  it("declares the document's task, date, and author", () => {
    expect(policy).toContain(
      "Task: FW-018. Date: 2026-08-16. Author: lead founding engineer (agent: GitHub Copilot, `gpt-pro`)."
    );
  });

  it("cites the normative sources that oblige it to exist", () => {
    expect(policy).toContain("NFR-011");
    expect(policy).toContain("SO-04");
    expect(policy).toContain("SO-05");
    expect(masterPrd).toContain(
      "Security controls fail closed for unsupported or invalid configurations"
    );
    expect(securityPrd).toContain("Invalid or unsupported security configuration fails closed");
  });

  it("defines fail closed, fail open, relaxation, and downgrade", () => {
    for (const term of [
      "**Security control.**",
      "**Fail closed.**",
      "**Fail open.**",
      "**Relaxation.**",
      "**Downgrade.**"
    ]) {
      expect(policy).toContain(term);
    }
  });

  it("declares a contiguous set of fail-closed rules starting at FC-1", () => {
    expect(declaredRules.length).toBeGreaterThanOrEqual(10);
    expect(declaredRules).toEqual(
      Array.from({ length: declaredRules.length }, (_, index) => `FC-${index + 1}`)
    );
  });

  it("reaches every declared rule from the decision table", () => {
    const uncited = declaredRules.filter((rule) => !citedRules.has(rule));
    expect(uncited).toEqual([]);
  });

  it("cites no rule the decision table has not declared", () => {
    const undeclared = [...citedRules].filter((rule) => !declaredRules.includes(rule));
    expect(undeclared).toEqual([]);
  });

  it("gives the decision table a row for a correctly declared relaxation and for a downgrade", () => {
    expect(policy).toContain("| A relaxation listed in section 5 is correctly declared |");
    expect(policy).toContain("| A reduction that section 5 does not list |");
    expect(policy).toContain("prohibited; the change is a downgrade");
  });

  it("inventories at least one escape hatch per relaxing requirement family", () => {
    expect(escapeHatches.length).toBeGreaterThanOrEqual(14);
    const families = new Set(escapeHatches.map((hatch) => hatch.requirement.replace(/-\d+$/, "")));
    for (const family of [
      "SEC-REQ",
      "SEC-CACHE",
      "SEC-SECRET",
      "SEC-DEV",
      "SEC-SUPPLY",
      "SEC-OBS"
    ]) {
      expect(families).toContain(family);
    }
  });

  it("names a real requirement at the priority the security PRD gives it", () => {
    for (const hatch of escapeHatches) {
      expect(requirementPriorities.get(hatch.requirement)).toBe(hatch.priority);
    }
  });

  it("fabricates no escape hatch: every requirement's own text permits an exception", () => {
    const permitting = /unless|explicit|configurable|override|opt-in|relaxation/i;
    for (const hatch of escapeHatches) {
      const body = requirementBodies.get(hatch.requirement);
      expect(body, `${hatch.requirement} has no body in the security PRD`).toBeDefined();
      expect(
        permitting.test(body as string),
        `${hatch.requirement} does not permit an exception in its normative text`
      ).toBe(true);
    }
  });

  it("gives every escape hatch an opt-in form, a required diagnostic, and an existing owner", () => {
    for (const hatch of escapeHatches) {
      expect(hatch.subject.length).toBeGreaterThan(0);
      expect(hatch.optIn.length).toBeGreaterThan(0);
      expect(hatch.diagnostic.length).toBeGreaterThan(0);
      expect(checklistTaskIds.has(hatch.owner), `${hatch.owner} is not in CHECKLIST.md`).toBe(true);
    }
  });

  it("requires every escape hatch to be local, named, and visible", () => {
    expect(policy).toContain("**Local.**");
    expect(policy).toContain("**Named.**");
    expect(policy).toContain("**Visible.**");
  });

  it("references only tasks that exist in the checklist", () => {
    const referenced = new Set([...`${policy}${adr}`.matchAll(/FW-\d+/g)].map((match) => match[0]));
    const missing = [...referenced].filter((id) => !checklistTaskIds.has(id)).sort();
    expect(missing).toEqual([]);
  });

  it("states the severity rule and forbids suppression", () => {
    expect(policy).toContain("**No mechanism suppresses a security diagnostic.**");
    expect(policy).toContain("No security diagnostic is `info`");
    expect(compiler).toContain('severity: "error" | "warning" | "info"');
  });

  it("keeps suppression absent from the documents that would have to define it", () => {
    expect(/suppress|ignore/i.test(observability)).toBe(false);
    expect(/suppress|ignore/i.test(compiler)).toBe(false);
    expect(observability).not.toContain("FW-018");
  });

  it("inherits the plugin prohibition rather than restating it as new authority", () => {
    expect(readText("docs/07_ADAPTERS_AND_PLUGINS.md")).toContain("disable security diagnostics");
    expect(policy).toContain("already forbids a plugin");
  });

  it("binds itself to the release gate that suppression would defeat", () => {
    expect(securityPrd).toContain("Security diagnostics contain no unresolved P0 issue");
    expect(policy).toContain("security diagnostics contain no unresolved P0 issue");
  });

  it("assigns every non-mechanical judgement to an executing role", () => {
    expect(policy).toContain("| Judgement | Executing role |");
    const judgements = [...policy.matchAll(/^\| (?!Judgement)([^|]+) \| ([^|]+) \|$/gm)].filter(
      (match) => !(match[1] as string).startsWith("-")
    );
    expect(judgements.length).toBeGreaterThanOrEqual(6);
    for (const match of judgements) {
      expect((match[2] as string).trim().length).toBeGreaterThan(0);
    }
  });

  it("claims no SEC-* coverage row and stays absent from the coverage map as an owner", () => {
    expect(policy).toContain("it discharges no `SEC-*` requirement");
    const coverageRows = [
      ...approvalRecord.matchAll(/^\| (SEC-[A-Z]+-\d+) \| P\d \| ([^|]+) \|/gm)
    ];
    expect(coverageRows.length).toBe(requirementPriorities.size);
    const rowsClaimingFw018 = coverageRows.filter((match) =>
      (match[2] as string).includes("FW-018")
    );
    expect(rowsClaimingFw018).toEqual([]);
  });

  it("records amendment A-3 for the constraint it adds to the approved baseline", () => {
    expect(approvalRecord).toContain("| A-3 | 2026-08-16 | FW-018 |");
    expect(approvalRecord).toContain("transferred no ownership");
  });

  it("continues the interpretation numbering held by the evidence workflow", () => {
    expect(evidenceWorkflow).toContain("I-1");
    expect(policy).not.toContain("**I-1.**");
    const interpretations = [...policy.matchAll(/\*\*(I-\d+)\.\*\*/g)].map(
      (match) => match[1] as string
    );
    expect(interpretations.length).toBeGreaterThanOrEqual(3);
    expect(new Set(interpretations).size).toBe(interpretations.length);
  });

  it("discloses residual risk without recording an accepted risk", () => {
    expect(policy).toContain("## 11. Residual risk accepted at M0");
    expect(policy).toContain("this task does not renew it again");
  });
});

describe("ADR-008", () => {
  it("exists with a permitted status and is not treated as accepted", () => {
    const status = adr.match(/^- Status: (\w+)/m);
    expect(status).not.toBeNull();
    expect(["Proposed", "Accepted", "Rejected", "Superseded"]).toContain(status?.[1]);
    expect(status?.[1]).toBe("Proposed");
  });

  it("follows the ADR template's required sections", () => {
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
    expect(adr).toMatch(/^- Security impact: (none|low|medium|high|critical)$/m);
    expect(adr).toMatch(/^- Related tasks: .*FW-018/m);
  });

  it("compares at least three options before deciding", () => {
    const options = [...adr.matchAll(/^### Option [A-Z] — /gm)];
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(adr).toMatch(/^\*\*Proposed: Option [A-Z]\.\*\* Not accepted\./m);
  });

  it("is reachable from the reserved-decision list, marked Proposed", () => {
    expect(decisions).toContain(
      "- ADR-008: Security-manifest schema and strict-mode behavior. `Proposed` — `docs/adr/ADR-008-security-manifest-and-strict-mode.md`."
    );
    expect(decisions).toContain(
      "they are not accepted authority until a corresponding ADR file has status `Accepted`"
    );
  });

  it("defers the security-manifest half to FW-107 rather than deciding it", () => {
    expect(adr).toContain("is not decided here");
    expect(checklistTaskIds.has("FW-107")).toBe(true);
  });

  it("is cited by the policy wherever the policy depends on it", () => {
    expect(policy).toContain("**An ADR does accompany this task, and it is not accepted.**");
    expect(policy).toContain("conditional on ADR-008");
  });

  it("keeps the mode a declaration rather than a control switch", () => {
    expect(adr).toContain("It is a declaration of posture, not a feature switch");
    expect(compiler).toContain('security: { mode: "strict" }');
  });
});

describe("propagation into the requirement index", () => {
  it("names the policy in the NFR-011 and FR-013 evidence cells", () => {
    const nfr011 = traceability.match(/^\| NFR-011 Fail closed \|.*$/m)?.[0] ?? "";
    expect(nfr011).toContain("docs/STRICT_SECURITY_MODE.md");
    expect(nfr011).toContain("tests/strict-security-mode.test.ts");
    expect(nfr011).toContain("FW-018");

    const fr013 = traceability.match(/^\| FR-013 Security PRD \|.*$/m)?.[0] ?? "";
    expect(fr013).toContain("docs/STRICT_SECURITY_MODE.md");
  });

  it("names the policy in the AC-SEC evidence cell without claiming a coverage row", () => {
    const acSec = traceability.match(/^\| AC-SEC-01–10 \|.*$/m)?.[0] ?? "";
    expect(acSec).toContain("docs/STRICT_SECURITY_MODE.md");
    expect(acSec).toContain("claims no coverage row of its own");
  });

  it("defines the terms it introduces in the glossary", () => {
    for (const entry of ["### Escape hatch", "### Fail closed", "### Strict security mode"]) {
      expect(glossary).toContain(entry);
    }
    const securitySection = (glossary.split("## Security and environment")[1] as string).split(
      /^## /m
    )[0] as string;
    for (const entry of ["### Escape hatch", "### Fail closed", "### Strict security mode"]) {
      expect(securitySection).toContain(entry);
    }
  });

  it("reserves FW- identifiers for checklist tasks, per the glossary style rules", () => {
    expect(glossary).toContain("Reserve `FW-<digits>` for checklist tasks.");
    expect(policy).not.toMatch(/FW-\d+(?:-|:)\s*(?:diagnostic|code)/);
  });
});
