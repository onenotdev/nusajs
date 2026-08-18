import { describe, expect, it } from "vitest";
import {
  assertManifestSupported,
  CAPABILITY_MANIFEST_NAME,
  CAPABILITY_MANIFEST_VERSION,
  createCapabilityManifest,
  createRouteManifest,
  createSecurityManifest,
  ROUTE_MANIFEST_NAME,
  ROUTE_MANIFEST_VERSION,
  SECURITY_MANIFEST_NAME,
  SECURITY_MANIFEST_VERSION,
  type RouteGraph
} from "../src/index.js";

const graph: RouteGraph = Object.freeze({
  routes: Object.freeze([
    Object.freeze({
      kind: "page",
      pattern: "/blog/[slug]",
      collisionKey: "/blog/[slug]",
      branch: Object.freeze(["blog"]),
      segments: Object.freeze([
        Object.freeze({ kind: "static", value: "blog" }),
        Object.freeze({ kind: "dynamic", value: "slug" })
      ]),
      specificity: Object.freeze([4, 3]),
      file: "blog/[slug].page.ts"
    }),
    Object.freeze({
      kind: "endpoint",
      pattern: "/health",
      collisionKey: "/health",
      branch: Object.freeze([]),
      segments: Object.freeze([Object.freeze({ kind: "static", value: "health" })]),
      specificity: Object.freeze([4]),
      file: "health.endpoint.ts"
    })
  ]),
  boundaries: Object.freeze([
    Object.freeze({ kind: "layout", scope: "/", branch: Object.freeze([]), file: "_layout.tsx" }),
    Object.freeze({
      kind: "layout",
      scope: "/blog",
      branch: Object.freeze(["blog"]),
      file: "blog/_layout.tsx"
    })
  ])
});

describe("createRouteManifest", () => {
  it("produces a versioned, deterministic route manifest", () => {
    const first = createRouteManifest(graph);
    const second = createRouteManifest(graph);
    expect(first.schema).toBe(ROUTE_MANIFEST_NAME);
    expect(first.version).toBe(ROUTE_MANIFEST_VERSION);
    expect(first.routes).toHaveLength(2);
    expect(first.routes[0]).toMatchObject({
      kind: "page",
      pattern: "/blog/[slug]",
      file: "blog/[slug].page.ts",
      specificity: [4, 3],
      layouts: [
        { file: "_layout.tsx", scope: "/" },
        { file: "blog/_layout.tsx", scope: "/blog" }
      ]
    });
    expect(first.routes[1]).not.toHaveProperty("layouts");
    expect(Object.isFrozen(first.routes[0])).toBe(true);
    expect(Object.isFrozen(first.routes[0]?.kind === "page" && first.routes[0].layouts)).toBe(true);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("derives stable route identities from role and pattern regardless of order", () => {
    const reversed = createRouteManifest({
      routes: Object.freeze([...graph.routes].reverse()),
      boundaries: Object.freeze([...graph.boundaries].reverse())
    });
    const forward = createRouteManifest(graph);
    expect(reversed.routes[0]?.id).toBe(forward.routes[1]?.id);
    expect(reversed.routes[1]?.id).toBe(forward.routes[0]?.id);
  });
});

describe("createSecurityManifest", () => {
  it("records the strict posture and names only, never values", () => {
    const manifest = createSecurityManifest({
      relaxations: ["unsafe-inline-style"],
      publicEnv: ["PUBLIC_API_URL"],
      diagnostics: [{ code: "NUSA-ROUTE-0002", count: 2 }]
    });
    expect(manifest.schema).toBe(SECURITY_MANIFEST_NAME);
    expect(manifest.version).toBe(SECURITY_MANIFEST_VERSION);
    expect(manifest.mode).toBe("strict");
    expect(manifest.relaxations).toEqual(["unsafe-inline-style"]);
    expect(manifest.publicEnv).toEqual(["PUBLIC_API_URL"]);
    expect(manifest.diagnostics).toEqual([{ code: "NUSA-ROUTE-0002", count: 2 }]);
  });

  it("defaults to an empty, strict manifest", () => {
    const manifest = createSecurityManifest();
    expect(manifest.mode).toBe("strict");
    expect(manifest.relaxations).toEqual([]);
    expect(manifest.publicEnv).toEqual([]);
    expect(manifest.diagnostics).toEqual([]);
  });

  it.each([
    ["invalid relaxation name", { relaxations: ["bad name"] }],
    ["invalid diagnostic code", { diagnostics: [{ code: "PLUGIN-0001", count: 1 }] }],
    ["negative diagnostic count", { diagnostics: [{ code: "NUSA-ROUTE-0002", count: -1 }] }]
  ])("fails closed for %s", (_name, input) => {
    expect(() => createSecurityManifest(input as never)).toThrow("[NUSA-CONFIG-0001]");
  });
});

describe("createCapabilityManifest", () => {
  it("records declared capabilities from the documented vocabulary", () => {
    const manifest = createCapabilityManifest({
      capabilities: [
        { route: "/chat", required: ["websocket"] },
        { route: "/files", required: ["streaming"] }
      ]
    });
    expect(manifest.schema).toBe(CAPABILITY_MANIFEST_NAME);
    expect(manifest.version).toBe(CAPABILITY_MANIFEST_VERSION);
    expect(manifest.capabilities).toEqual([
      { route: "/chat", required: ["websocket"] },
      { route: "/files", required: ["streaming"] }
    ]);
  });

  it("fails closed for an unsupported capability", () => {
    expect(() =>
      createCapabilityManifest({ capabilities: [{ route: "/x", required: ["teleport"] }] })
    ).toThrow("[NUSA-CONFIG-0001]");
  });
});

describe("assertManifestSupported", () => {
  it("accepts matching schemas at or below the supported major", () => {
    expect(() =>
      assertManifestSupported(
        { schema: ROUTE_MANIFEST_NAME, version: ROUTE_MANIFEST_VERSION },
        ROUTE_MANIFEST_NAME,
        ROUTE_MANIFEST_VERSION
      )
    ).not.toThrow();
    expect(() =>
      assertManifestSupported(
        { schema: SECURITY_MANIFEST_NAME, version: 1 },
        SECURITY_MANIFEST_NAME,
        2
      )
    ).not.toThrow();
  });

  it("rejects unsupported major versions, wrong schemas, and invalid shapes", () => {
    expect(() =>
      assertManifestSupported(
        { schema: SECURITY_MANIFEST_NAME, version: 2 },
        SECURITY_MANIFEST_NAME,
        1
      )
    ).toThrow("not supported");
    expect(() =>
      assertManifestSupported({ schema: "other-manifest", version: 1 }, SECURITY_MANIFEST_NAME, 1)
    ).toThrow("[NUSA-CONFIG-0001]");
    expect(() =>
      assertManifestSupported(
        { schema: SECURITY_MANIFEST_NAME, version: 0 },
        SECURITY_MANIFEST_NAME,
        1
      )
    ).toThrow("[NUSA-CONFIG-0001]");
  });
});
