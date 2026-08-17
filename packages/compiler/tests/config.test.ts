import { describe, expect, it } from "vitest";
import { CONFIG_DOCS_SLUG, parseConfig } from "../src/index.js";

function source(body: string): string {
  return `import { defineConfig } from \"nusajs\";\n\nexport default defineConfig(${body});\n`;
}

describe("parseConfig", () => {
  it("loads a valid static configuration without executing it", () => {
    const result = parseConfig(
      source(
        '{ adapter: node(), renderer: preact(), output: "server", plugins: [], security: { mode: "strict" } }'
      ),
      "nusa.config.ts"
    );
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.config.output).toBe("server");
    expect(result.config.securityMode).toBe("strict");
    // Function calls are never executed and are recorded as dynamic values.
    expect(result.config.dynamicValues).toEqual(["<config>.adapter", "<config>.renderer"]);
  });

  it("defaults security mode and output when keys are absent", () => {
    const result = parseConfig(source("{}"), "nusa.config.ts");
    expect(result.valid).toBe(true);
    expect(result.config.securityMode).toBe("strict");
    expect(result.config.output).toBe("server");
  });

  it("accepts a static output value", () => {
    const result = parseConfig(source('{ output: "static" }'), "nusa.config.ts");
    expect(result.valid).toBe(true);
    expect(result.config.output).toBe("static");
  });

  it("fails closed with an exact property path for an illegal security mode", () => {
    const result = parseConfig(source('{ security: { mode: "compatible" } }'), "nusa.config.ts");
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "NUSA-CONFIG-0001",
      path: "<config>.security.mode",
      expected: 'the string "strict"',
      received: "a string",
      docs: CONFIG_DOCS_SLUG
    });
  });

  it("rejects case variants of the security mode", () => {
    const result = parseConfig(source('{ security: { mode: "Strict" } }'), "nusa.config.ts");
    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.path).toBe("<config>.security.mode");
  });

  it("fails closed for an invalid output value with a secret-free description", () => {
    const result = parseConfig(source("{ output: 42 }"), "nusa.config.ts");
    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      path: "<config>.output",
      expected: 'the string "server" or "static"',
      received: "a number"
    });
  });

  it("rejects unknown top-level properties", () => {
    const result = parseConfig(source('{ secret: "hunter2" }'), "nusa.config.ts");
    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      path: "<config>",
      received: "a string"
    });
    expect(JSON.stringify(result)).not.toContain("hunter2");
  });

  it("rejects reserved property names before assignment", () => {
    const result = parseConfig(
      source('{ \"__proto__\": { polluted: true }, output: "server" }'),
      "nusa.config.ts"
    );
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((entry) => entry.path === "<config>.__proto__")).toBe(true);
    expect(result.config.output).toBe("server");
  });

  it("rejects unknown security properties and non-object security values", () => {
    const nonObject = parseConfig(source('{ security: \"strict\" }'), "nusa.config.ts");
    expect(nonObject.valid).toBe(false);
    expect(nonObject.diagnostics[0]?.path).toBe("<config>.security");
    const unknown = parseConfig(source("{ security: { strict: true } }"), "nusa.config.ts");
    expect(unknown.valid).toBe(false);
    expect(unknown.diagnostics[0]?.path).toBe("<config>.security.strict");
  });

  it("fails closed on syntax errors and missing configuration", () => {
    const broken = parseConfig(
      "export default defineConfig({ security: { mode: ",
      "nusa.config.ts"
    );
    expect(broken.valid).toBe(false);
    expect(broken.diagnostics[0]?.path).toBe("<config>");
    const missing = parseConfig("export const x = 1;\n", "nusa.config.ts");
    expect(missing.valid).toBe(false);
    expect(missing.diagnostics[0]?.remediation).toContain("defineConfig");
  });

  it("records dynamic values instead of executing or guessing them", () => {
    const result = parseConfig(
      source('{ adapter: chooseAdapter(), plugins: [pluginA(), pluginB()], output: "server" }'),
      "nusa.config.ts"
    );
    expect(result.valid).toBe(true);
    expect(result.config.dynamicValues).toEqual([
      "<config>.adapter",
      "<config>.plugins[0]",
      "<config>.plugins[1]"
    ]);
  });

  it("rejects excessive nesting depth", () => {
    const deep = "{ a: ".repeat(10) + "1" + " }".repeat(10);
    const result = parseConfig(source(deep), "nusa.config.ts");
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((entry) => entry.expected.includes("nesting depth"))).toBe(true);
  });

  it("is deterministic across repeated parses", () => {
    const first = parseConfig(source('{ output: "server" }'), "nusa.config.ts");
    const second = parseConfig(source('{ output: "server" }'), "nusa.config.ts");
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
