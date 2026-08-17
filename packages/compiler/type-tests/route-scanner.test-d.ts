import type { ParsedRoute, RouteFileRecord, RouteScanOptions } from "../src/index.js";

const options: RouteScanOptions = { root: "/absolute/routes" };
const record: RouteFileRecord = {
  kind: "page",
  relativePath: "about.page.tsx",
  normalizedPath: "about.page.tsx"
};

void options;
void record;

const parsed: ParsedRoute = {
  kind: "page",
  pattern: "/about",
  collisionKey: "/about",
  segments: [{ kind: "static", value: "about" }],
  specificity: [4],
  file: "about.page.ts"
};
void parsed;

// @ts-expect-error unknown route roles are rejected
const invalid: RouteFileRecord = { kind: "middleware", relativePath: "x", normalizedPath: "x" };
void invalid;
