import { describe, expect, it } from "vitest";
import {
  createDiagnostic,
  formatDevelopmentDiagnostic,
  formatProductionDiagnostic,
  serializeDevelopmentDiagnostic
} from "../src/index.js";

const docsOrigin = "https://docs.nusajs.example";

describe("diagnostic model", () => {
  it("creates an immutable diagnostic with a registry-owned documentation URL", () => {
    const diagnostic = createDiagnostic(
      {
        code: "NUSA-ROUTE-0001",
        message: "Conflicting route pattern: /blog/:slug",
        file: "src/routes/blog/[slug].page.tsx",
        range: { start: { line: 4, column: 2 }, end: { line: 4, column: 18 } },
        hint: "Rename one route so each URL is unique."
      },
      docsOrigin
    );

    expect(diagnostic).toEqual({
      code: "NUSA-ROUTE-0001",
      severity: "error",
      message: "Conflicting route pattern: /blog/:slug",
      file: "src/routes/blog/[slug].page.tsx",
      range: { start: { line: 4, column: 2 }, end: { line: 4, column: 18 } },
      hint: "Rename one route so each URL is unique.",
      docs: "https://docs.nusajs.example/errors/nusa-route-0001"
    });
    expect(Object.isFrozen(diagnostic)).toBe(true);
    expect(Object.isFrozen(diagnostic.range)).toBe(true);
    expect(Object.isFrozen(diagnostic.range?.start)).toBe(true);
  });

  it("formats deterministic development text and JSON", () => {
    const diagnostic = createDiagnostic(
      {
        code: "NUSA-CONFIG-0001",
        message: "Configuration value is invalid.",
        file: "nusa.config.ts",
        range: { start: { line: 2, column: 3 }, end: { line: 2, column: 9 } },
        hint: "Use a supported value."
      },
      `${docsOrigin}/ignored/base/`
    );
    expect(formatDevelopmentDiagnostic(diagnostic)).toMatchInlineSnapshot(`
      "[NUSA-CONFIG-0001] Configuration value is invalid.
      Severity: error
      File: nusa.config.ts:2:3-2:9
      Fix: Use a supported value.
      Docs: https://docs.nusajs.example/errors/nusa-config-0001"
    `);
    expect(serializeDevelopmentDiagnostic(diagnostic)).toBe(JSON.stringify(diagnostic));
  });

  it.each([
    ["absolute POSIX path", { file: "/secret/project.ts" }],
    ["absolute Windows path", { file: "C:/secret/project.ts" }],
    ["traversal path", { file: "src/../secret.ts" }],
    ["backslash path", { file: "src\\secret.ts" }],
    [
      "range without file",
      { range: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } } }
    ],
    [
      "reversed range",
      { file: "src/a.ts", range: { start: { line: 2, column: 1 }, end: { line: 1, column: 1 } } }
    ]
  ])("rejects invalid %s", (_name, invalid) => {
    expect(() =>
      createDiagnostic(
        { code: "NUSA-CONFIG-0001", message: "Invalid configuration.", ...invalid },
        docsOrigin
      )
    ).toThrow("NUSA-INTERNAL-0001");
  });

  it.each([
    "http://docs.nusajs.example",
    "https://user:password@docs.nusajs.example",
    "https://docs.nusajs.example?secret=value",
    "https://docs.nusajs.example#fragment",
    "not a URL"
  ])("rejects unsafe documentation origin %s", (origin) => {
    expect(() =>
      createDiagnostic({ code: "NUSA-ROUTE-0001", message: "Route conflict." }, origin)
    ).toThrow("NUSA-INTERNAL-0001");
  });

  it("prevents informational security diagnostics", () => {
    expect(() =>
      createDiagnostic(
        { code: "NUSA-SECURITY-0001", severity: "info", message: "Unsafe relaxation." },
        docsOrigin
      )
    ).toThrow("security diagnostics cannot have info severity");
  });
});

describe("production diagnostic boundary", () => {
  it("returns exactly the allowlisted code and request ID", () => {
    expect(formatProductionDiagnostic("NUSA-SERVER-0001", "req_A1b2C3d4")).toEqual({
      code: "NUSA-SERVER-0001",
      requestId: "req_A1b2C3d4"
    });
  });

  it("fails closed and excludes hostile diagnostic values", () => {
    const hostile = "token=secret\nC:\\Users\\private\\app.ts<script>alert(1)</script>";
    const output = formatProductionDiagnostic(hostile, "safe_req_1234");
    const serialized = JSON.stringify(output);
    expect(output).toEqual({ code: "NUSA-SERVER-0001", requestId: "safe_req_1234" });
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("Users");
    expect(serialized).not.toContain("script");
    expect(Object.keys(output)).toEqual(["code", "requestId"]);
    expect(Object.isFrozen(output)).toBe(true);
  });

  it.each([
    "short",
    "contains space",
    "contains.secret",
    "a".repeat(129)
  ])("rejects unsafe request ID %s", (requestId) => {
    expect(() => formatProductionDiagnostic("NUSA-SERVER-0001", requestId)).toThrow(
      "NUSA-INTERNAL-0001"
    );
  });
});
