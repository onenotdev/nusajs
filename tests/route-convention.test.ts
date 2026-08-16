import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..");

/** One measured collision fixture outcome for a single convention. */
interface CollisionCaseResult {
  id: string;
  expressibleAsDistinctFiles: boolean;
  preventedByFilesystem: boolean;
  detected: boolean;
  allConflictingFilesNamed: boolean;
}

/** One measured convention row from the FW-004 spike report. */
interface ConventionResult {
  id: string;
  reservedNameCount: number;
  maxSpellingsPerUrl: number;
  totalSpellings: number;
  precedenceTies: string[][];
  collisionCases: CollisionCaseResult[];
}

/** One analyzer outcome for a single route-module fixture. */
interface AnalyzerOutcome {
  outcome: "read" | "diagnostic" | "not-found";
  steps: number;
  crossModule: boolean;
}

/** The generated FW-004 evidence file that ADR-003 and ADR-004 cite. */
interface SpikeReport {
  failures: string[];
  environment: { node: string; platform: string; typescript: string };
  conventions: ConventionResult[];
  filesystem: {
    platform: string;
    createdPaths: number;
    rejectedPaths: string[];
    caseInsensitive: boolean;
    unicodeFolding: boolean;
  };
  moduleApis: {
    namedExports: {
      literal: AnalyzerOutcome;
      computed: AnalyzerOutcome;
      crossModuleResolutionRequired: boolean;
      silentMissWithNaiveMatcher: boolean;
    };
    definePage: {
      aliasedNaive: AnalyzerOutcome;
      literalResolved: AnalyzerOutcome;
      aliasedResolved: AnalyzerOutcome;
      crossModuleResolutionRequired: boolean;
      silentMissWithNaiveMatcher: boolean;
    };
  };
}

function readText(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

/**
 * Collapses hard-wrapped prose to single spaces. Markdown in this repository is
 * wrapped at prose width, so a quoted requirement can straddle a line break and
 * would otherwise be unfindable by a literal substring check.
 */
function unwrap(document: string): string {
  return document.replace(/\s+/g, " ");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

const ADR_003 = "docs/adr/ADR-003-route-filesystem-convention.md";
const ADR_004 = "docs/adr/ADR-004-route-module-api-syntax.md";
const SPIKE_JSON = "spikes/route-convention/results/route-convention-comparison.json";
const SPIKE_MARKDOWN = "spikes/route-convention/results/route-convention-comparison.md";

const REQUIRED_HEADINGS = [
  "## Context",
  "## Decision drivers",
  "## Options",
  "## Decision",
  "## Consequences",
  "## Security analysis",
  "## Verification",
  "## Rollback or supersede plan"
];

const adr003 = readText(ADR_003);
const adr004 = readText(ADR_004);
const report = readJson<SpikeReport>(SPIKE_JSON);

/** Collects every `PREFIX-NNN` style identifier of one family used by a document. */
function referencedIds(document: string, pattern: RegExp): Set<string> {
  const found = new Set<string>();
  for (const match of document.matchAll(pattern)) {
    const id = match[1];
    if (id !== undefined) {
      found.add(id);
    }
  }
  return found;
}

describe("FW-004 route convention and module API decisions", () => {
  for (const [name, document] of [
    ["ADR-003", adr003],
    ["ADR-004", adr004]
  ] as const) {
    describe(name, () => {
      it("follows the ADR template structure", () => {
        for (const heading of REQUIRED_HEADINGS) {
          expect(document, `${name} is missing ${heading}`).toContain(`\n${heading}\n`);
        }
      });

      it("declares a recognised status, a date, an owner, and a security impact", () => {
        expect(document).toMatch(/^- Status: (Proposed|Accepted|Superseded|Rejected)$/m);
        expect(document).toMatch(/^- Date: \d{4}-\d{2}-\d{2}$/m);
        expect(document).toMatch(/^- Owner: .+$/m);
        expect(document).toMatch(/^- Security impact: (none|low|medium|high|critical)$/m);
      });

      it("is accepted authority, because FW-004 exists to close the decision", () => {
        expect(document).toMatch(/^- Status: Accepted$/m);
      });

      it("compares at least three real options", () => {
        const options = document.match(/^### Option [A-Z] — /gm) ?? [];
        expect(options.length).toBeGreaterThanOrEqual(3);
      });

      it("cites the spike evidence rather than asserting a preference", () => {
        expect(document).toContain(SPIKE_MARKDOWN);
      });

      it("names only checklist task IDs that exist", () => {
        const checklist = readText("CHECKLIST.md");
        const known = referencedIds(checklist, /\*\*(FW-\d+) \[/g);

        for (const id of referencedIds(document, /\b(FW-\d+)\b/g)) {
          expect(known, `${name} cites unknown task ${id}`).toContain(id);
        }
      });

      it("names only security requirement IDs that exist", () => {
        const securityPrd = readText("docs/09_SECURITY_PRD.md");
        const known = referencedIds(securityPrd, /^### (SEC-[A-Z]+-\d+) \[P\d\]/gm);
        const families = new Set([...known].map((id) => id.replace(/-\d+$/, "")));

        for (const id of referencedIds(document, /\b(SEC-[A-Z]+-(?:\d+|\*))\b/g)) {
          if (id.endsWith("-*")) {
            expect(families, `${name} cites unknown family ${id}`).toContain(id.slice(0, -2));
            continue;
          }
          expect(known, `${name} cites unknown requirement ${id}`).toContain(id);
        }
      });

      it("names only routing acceptance criteria that exist", () => {
        const routingPrd = readText("docs/03_ROUTING_AND_NAVIGATION.md");
        const known = referencedIds(routingPrd, /\b(AC-ROUTE-\d+)\b/g);
        expect(known.size).toBeGreaterThan(0);

        for (const id of referencedIds(document, /\b(AC-ROUTE-\d+)\b/g)) {
          expect(known, `${name} cites unknown criterion ${id}`).toContain(id);
        }
      });

      it("states what it does not verify, so acceptance is not read as implementation", () => {
        expect(document).toMatch(/not\*{0,2} verified/i);
      });
    });
  }

  it("records ADR-003's three binding amendments", () => {
    for (const amendment of ["**A1 —", "**A2 —", "**A3 —"]) {
      expect(adr003).toContain(amendment);
    }
  });

  it("records ADR-004's four binding commitments", () => {
    for (const commitment of ["**C1 —", "**C2 —", "**C3 —", "**C4 —"]) {
      expect(adr004).toContain(commitment);
    }
  });

  it("keeps ADR-004 aligned with the no-execution rule", () => {
    expect(unwrap(adr004)).toContain("must not execute complete application modules");
    expect(adr004).toContain("ts.createSourceFile");
  });

  it("keeps the two decisions separated, so neither silently widens the other", () => {
    expect(adr003).toContain("That is ADR-004.");
    expect(adr004).toContain("(ADR-003)");
  });
});

describe("FW-004 spike evidence", () => {
  it("passed every enforced check when it was generated", () => {
    expect(report.failures).toEqual([]);
  });

  it("records the environment the measurements came from", () => {
    expect(report.environment.node).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(report.environment.platform.length).toBeGreaterThan(0);
    expect(report.environment.typescript).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("compares the three conventions the ADR discusses", () => {
    expect(report.conventions.map((entry) => entry.id)).toEqual(["suffix", "folder", "manifest"]);
  });

  it("reports every expressible collision and names all conflicting files", () => {
    for (const convention of report.conventions) {
      for (const collision of convention.collisionCases) {
        if (!collision.expressibleAsDistinctFiles) {
          expect(collision.preventedByFilesystem).toBe(true);
          continue;
        }
        expect(collision.detected, `${convention.id}/${collision.id} undetected`).toBe(true);
        expect(collision.allConflictingFilesNamed).toBe(true);
      }
    }
  });

  it("derives precedence from patterns rather than enumeration order", () => {
    for (const convention of report.conventions) {
      expect(convention.precedenceTies, `${convention.id} has precedence ties`).toEqual([]);
    }
  });

  it("measures the aliasing surface that ADR-003 amendment A1 exists to close", () => {
    const suffix = report.conventions.find((entry) => entry.id === "suffix");
    expect(suffix?.maxSpellingsPerUrl).toBeGreaterThan(1);
  });

  it("shows the filesystem cannot be trusted to fold route keys consistently", () => {
    expect(report.filesystem.caseInsensitive).not.toBe(report.filesystem.unicodeFolding);
    expect(report.filesystem.createdPaths).toBeGreaterThan(0);
    expect(report.filesystem.rejectedPaths).toEqual([]);
  });

  it("shows named exports need no cross-module resolution and cannot miss silently", () => {
    const named = report.moduleApis.namedExports;

    expect(named.literal.outcome).toBe("read");
    expect(named.computed.outcome).toBe("diagnostic");
    expect(named.literal.crossModule).toBe(false);
    expect(named.crossModuleResolutionRequired).toBe(false);
    expect(named.silentMissWithNaiveMatcher).toBe(false);
  });

  it("shows the call-based form has a measured silent-miss failure mode", () => {
    const wrapped = report.moduleApis.definePage;

    expect(wrapped.aliasedNaive.outcome).toBe("not-found");
    expect(wrapped.aliasedResolved.outcome).toBe("read");
    expect(wrapped.literalResolved.crossModule).toBe(true);
    expect(wrapped.crossModuleResolutionRequired).toBe(true);
    expect(wrapped.silentMissWithNaiveMatcher).toBe(true);
    expect(wrapped.literalResolved.steps).toBeGreaterThan(
      report.moduleApis.namedExports.literal.steps
    );
  });
});

describe("FW-004 decision propagation", () => {
  it("closes the Master PRD open decision it resolves", () => {
    const masterPrd = readText("docs/00_MASTER_PRD.md");
    const openDecisions = masterPrd.split(/^## 15\. Open decisions$/m)[1] ?? "";

    expect(openDecisions).toContain("~~Route-module syntax");
    expect(openDecisions).toContain("ADR-004-route-module-api-syntax.md");
  });

  it("promotes both reserved decision IDs to accepted files", () => {
    const decisions = readText("docs/13_POSITIONING_RISKS_AND_DECISIONS.md");

    expect(decisions).toMatch(
      /^- ADR-003: Route filesystem convention\. `Accepted` — `docs\/adr\/ADR-003-route-filesystem-convention\.md`\./m
    );
    expect(decisions).toMatch(
      /^- ADR-004: Route-module API syntax\. `Accepted` — `docs\/adr\/ADR-004-route-module-api-syntax\.md`\./m
    );
  });

  it("records the decisions as traceability evidence", () => {
    const matrix = readText("docs/14_REQUIREMENTS_TRACEABILITY.md");

    expect(matrix).toContain("adr/ADR-003-route-filesystem-convention.md");
    expect(matrix).toContain("adr/ADR-004-route-module-api-syntax.md");
  });

  it("keeps the spike framed as throwaway measurement code", () => {
    const readme = readText("spikes/route-convention/README.md");

    expect(readme).toContain("throwaway measurement spike");
    expect(readme).toContain("no framework code may import it");
    expect(readme).toContain("No performance or match-time claim");
  });
});
