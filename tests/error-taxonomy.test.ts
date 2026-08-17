import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const subsystems = new Set([
  "CLI",
  "CONFIG",
  "ROUTE",
  "RENDER",
  "DATA",
  "CACHE",
  "SERVER",
  "ADAPTER",
  "PLUGIN",
  "SECURITY",
  "INTERNAL"
]);
const grammar = /^NUSA-([A-Z][A-Z0-9]{1,11})-([0-9]{4})$/;

interface RegistryEntry {
  code: string;
  subsystem: string;
  summary: string;
  defaultSeverity: "error" | "warning" | "info";
  stability: "experimental" | "stable";
  documentationSlug: string;
  status: "active" | "retired";
}

interface Registry {
  schemaVersion: number;
  entries: RegistryEntry[];
}

function readText(path: string): string {
  return readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");
}

function parseCoreCode(code: string): { subsystem: string; number: number } | undefined {
  const match = grammar.exec(code);
  if (match === null) return undefined;
  const subsystem = match[1];
  const numberText = match[2];
  if (subsystem === undefined || numberText === undefined || !subsystems.has(subsystem)) {
    return undefined;
  }
  const number = Number(numberText);
  return number === 0 ? undefined : { subsystem, number };
}

const registry = JSON.parse(readText("docs/error-codes.json")) as Registry;

describe("FW-006 error-code taxonomy", () => {
  it("accepts only canonical registered core codes", () => {
    expect(parseCoreCode("NUSA-ROUTE-0001")).toEqual({ subsystem: "ROUTE", number: 1 });
    for (const invalid of [
      "nusa-route-0001",
      "NUSA-UNKNOWN-0001",
      "NUSA-ROUTE-0000",
      "NUSA-ROUTE-10000",
      "NUSA-ROUTE-0001-extra",
      "NUSA-THIRDPARTY-0001"
    ]) {
      expect(parseCoreCode(invalid), invalid).toBeUndefined();
    }
  });

  it("records every required field with matching identity and deterministic slug", () => {
    expect(registry.schemaVersion).toBe(1);
    for (const entry of registry.entries) {
      const parsed = parseCoreCode(entry.code);
      expect(parsed, entry.code).toBeDefined();
      expect(parsed?.subsystem).toBe(entry.subsystem);
      expect(entry.summary.trim()).toBe(entry.summary);
      expect(entry.summary.length).toBeGreaterThan(0);
      expect(entry.documentationSlug).toBe(`/errors/${entry.code.toLowerCase()}`);
    }
  });

  it("keeps codes and subsystem allocations unique and ordered", () => {
    const codes = registry.entries.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);

    const previous = new Map<string, number>();
    for (const entry of registry.entries) {
      const parsed = parseCoreCode(entry.code);
      expect(parsed).toBeDefined();
      const last = previous.get(entry.subsystem) ?? 0;
      expect(parsed?.number).toBeGreaterThan(last);
      previous.set(entry.subsystem, parsed?.number ?? last);
    }
  });

  it("retains the experimental tombstone in allocation checks", () => {
    const tombstone = registry.entries.find((entry) => entry.code === "NUSA-ROUTE-0002");
    expect(tombstone).toMatchObject({ stability: "experimental", status: "retired" });
    expect(
      Math.max(
        ...registry.entries
          .filter((entry) => entry.subsystem === "ROUTE")
          .map((entry) => parseCoreCode(entry.code)?.number ?? 0)
      )
    ).toBe(2);
  });

  it("restricts security diagnostics to error or warning", () => {
    const securityEntries = registry.entries.filter((entry) => entry.subsystem === "SECURITY");
    expect(securityEntries.length).toBeGreaterThan(0);
    for (const entry of securityEntries) {
      expect(["error", "warning"]).toContain(entry.defaultSeverity);
    }
  });

  it("contains all six required candidate exercises", () => {
    for (const code of [
      "NUSA-ROUTE-0001",
      "NUSA-CONFIG-0001",
      "NUSA-ADAPTER-0001",
      "NUSA-SECURITY-0001",
      "NUSA-INTERNAL-0001",
      "NUSA-SERVER-0001"
    ]) {
      expect(
        registry.entries.some((entry) => entry.code === code && entry.status === "active")
      ).toBe(true);
    }
  });

  it("documents allocation, retirement, extension, and production-safety boundaries", () => {
    const policy = readText("docs/ERROR_CODE_TAXONOMY.md");
    expect(policy).toContain("Allocate one greater than the highest number ever allocated");
    expect(policy).toContain("permanent tombstones");
    expect(policy).toContain("Third-party extensions must not mint `NUSA-*` codes");
    expect(policy).toContain("does not make a message, cause, path, location, remediation");
    expect(policy).toContain("discharges no `SEC-*` requirement");
  });

  it("keeps the accepted ADR and decision register synchronized", () => {
    expect(readText("docs/adr/ADR-007-error-code-taxonomy.md")).toContain("- Status: Accepted");
    expect(readText("docs/13_POSITIONING_RISKS_AND_DECISIONS.md")).toContain(
      "ADR-007: Error-code taxonomy. `Accepted`"
    );
  });
});
