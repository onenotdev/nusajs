import { describe, expect, it } from "vitest";
import {
  createSecurityHeaders,
  mergeSecurityHeaders,
  mergeSecurityHeadersStrict
} from "../src/index.js";

function headerNames(headers: Headers): string[] {
  const names: string[] = [];
  headers.forEach((_value, name) => {
    names.push(name);
  });
  return names;
}

function headerEntries(headers: Headers): readonly (readonly [string, string])[] {
  const entries: [string, string][] = [];
  headers.forEach((value, name) => {
    entries.push([name, value]);
  });
  return entries;
}

function headerSize(headers: Headers): number {
  let count = 0;
  headers.forEach(() => {
    count += 1;
  });
  return count;
}

describe("createSecurityHeaders", () => {
  it("serializes every configured value deterministically", () => {
    const headers = createSecurityHeaders({
      cacheControl: "no-store",
      frameOptions: "DENY",
      referrerPolicy: "no-referrer",
      contentTypeOptions: "nosniff",
      hsts: { maxAge: 31_536_000 },
      csp: { "default-src": ["'self'"] },
      permissionsPolicy: { geolocation: [] },
      crossOriginIsolation: { coop: "same-origin", corp: "same-origin" }
    });
    expect(headerNames(headers).sort()).toEqual([
      "cache-control",
      "content-security-policy",
      "cross-origin-opener-policy",
      "cross-origin-resource-policy",
      "permissions-policy",
      "referrer-policy",
      "strict-transport-security",
      "x-content-type-options",
      "x-frame-options"
    ]);
    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("cross-origin-opener-policy")).toBe("same-origin");
  });

  it("serializes CSP directives in canonical order", () => {
    const headers = createSecurityHeaders({
      csp: {
        "script-src": ["'self'", "'nonce-abc'"],
        "default-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "upgrade-insecure-requests": true
      }
    });
    expect(headers.get("content-security-policy")).toBe(
      "default-src 'self'; script-src 'self' 'nonce-abc'; frame-ancestors 'none'; upgrade-insecure-requests"
    );
  });

  it("serializes HSTS, permissions policy, and isolation headers", () => {
    const headers = createSecurityHeaders({
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      permissionsPolicy: { geolocation: [], camera: ["'self'"], microphone: ["'self'"] },
      crossOriginIsolation: { coop: "same-origin-allow-popups", corp: "cross-origin" }
    });
    expect(headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains; preload"
    );
    expect(headers.get("permissions-policy")).toBe(
      "geolocation=(); camera=('self'); microphone=('self')"
    );
    expect(headers.get("cross-origin-opener-policy")).toBe("same-origin-allow-popups");
    expect(headers.get("cross-origin-resource-policy")).toBe("cross-origin");
  });

  it("produces no headers for an empty option set", () => {
    expect(headerSize(createSecurityHeaders({}))).toBe(0);
  });

  it.each([
    ["line break in cache control", { cacheControl: "no-store\r\nx-evil: 1" }],
    ["unknown CSP directive", { csp: { "not-a-directive": ["x"] } }],
    ["empty CSP value", { csp: { "default-src": [] } }],
    ["CSP value with semicolon", { csp: { "default-src": ["'self'; script-src 'none'"] } }],
    ["unknown permissions feature", { permissionsPolicy: { "not-a-feature": ["'self'"] } }],
    ["negative hsts maxAge", { hsts: { maxAge: -1 } }],
    ["fractional hsts maxAge", { hsts: { maxAge: 1.5 } }],
    ["empty referrer policy", { referrerPolicy: "" as never }]
  ])("fails closed for %s", (_name, options) => {
    expect(() => createSecurityHeaders(options as never)).toThrow("[NUSA-SECURITY-0001]");
  });
});

describe("mergeSecurityHeaders", () => {
  it("keeps identical values once and appends new child headers in child order", () => {
    const parent = new Headers({ "x-content-type-options": "nosniff", "x-parent": "a" });
    const child = new Headers({ "x-content-type-options": "nosniff", "x-child": "b" });
    const result = mergeSecurityHeaders(parent, child);
    expect(result.conflicts).toEqual([]);
    expect(result.headers.get("x-content-type-options")).toBe("nosniff");
    expect(result.headers.get("x-parent")).toBe("a");
    expect(result.headers.get("x-child")).toBe("b");
  });

  it("keeps the stricter parent value and reports scalar conflicts", () => {
    const parent = new Headers({ "x-frame-options": "DENY", "cache-control": "no-store" });
    const child = new Headers({ "x-frame-options": "SAMEORIGIN", "cache-control": "public" });
    const result = mergeSecurityHeaders(parent, child);
    expect(result.headers.get("x-frame-options")).toBe("DENY");
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect([...result.conflicts].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "cache-control", parentValue: "no-store", childValue: "public", reason: "scalar" },
      { name: "x-frame-options", parentValue: "DENY", childValue: "SAMEORIGIN", reason: "scalar" }
    ]);
  });

  it("unions disjoint CSP directives and keeps parent directives on conflict", () => {
    const parent = createSecurityHeaders({
      csp: { "default-src": ["'self'"], "frame-ancestors": ["'none'"] }
    });
    const child = createSecurityHeaders({
      csp: { "script-src": ["'self'"], "frame-ancestors": ["'self'"] }
    });
    const result = mergeSecurityHeaders(parent, child);
    // script-src is disjoint and added; frame-ancestors conflict keeps the parent value.
    expect(result.headers.get("content-security-policy")).toBe(
      "default-src 'self'; frame-ancestors 'none'; script-src 'self'"
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      name: "content-security-policy",
      reason: "csp-directive"
    });
  });

  it("treats a child subset of a parent directive as compatible", () => {
    const parent = createSecurityHeaders({ csp: { "default-src": ["'self'", "https://a.test"] } });
    const child = createSecurityHeaders({ csp: { "default-src": ["'self'"] } });
    const result = mergeSecurityHeaders(parent, child);
    expect(result.conflicts).toEqual([]);
    expect(result.headers.get("content-security-policy")).toBe("default-src 'self' https://a.test");
  });

  it("reports conflicting Vary and surrogate headers for cache safety", () => {
    const parent = new Headers({ vary: "accept-encoding", "cache-control": "no-store" });
    const child = new Headers({ vary: "cookie", "cache-control": "no-store" });
    const result = mergeSecurityHeaders(parent, child);
    expect(result.headers.get("vary")).toBe("accept-encoding");
    expect(result.conflicts.some((conflict) => conflict.name === "vary")).toBe(true);
  });

  it("is deterministic across repeated merges", () => {
    const parent = createSecurityHeaders({
      csp: { "default-src": ["'self'"] },
      frameOptions: "DENY"
    });
    const child = createSecurityHeaders({
      csp: { "script-src": ["'self'"] },
      cacheControl: "no-store"
    });
    const first = mergeSecurityHeaders(parent, child);
    const second = mergeSecurityHeaders(parent, child);
    expect(headerEntries(first.headers)).toEqual(headerEntries(second.headers));
    expect(first.conflicts).toEqual(second.conflicts);
  });

  it("throws on conflict in the strict variant", () => {
    const parent = new Headers({ "x-frame-options": "DENY" });
    const child = new Headers({ "x-frame-options": "SAMEORIGIN" });
    expect(() => mergeSecurityHeadersStrict(parent, child)).toThrow("[NUSA-SECURITY-0001]");
  });

  it("returns merged headers without throwing when the strict merge is compatible", () => {
    const parent = new Headers({ "x-content-type-options": "nosniff" });
    const child = new Headers({ "cache-control": "no-store" });
    expect(mergeSecurityHeadersStrict(parent, child).get("cache-control")).toBe("no-store");
  });
});
