import type { RouteFileRecord, RouteScanOptions } from "../src/index.js";

const options: RouteScanOptions = { root: "/absolute/routes" };
const record: RouteFileRecord = {
  kind: "page",
  relativePath: "about.page.tsx",
  normalizedPath: "about.page.tsx"
};

void options;
void record;

// @ts-expect-error unknown route roles are rejected
const invalid: RouteFileRecord = { kind: "middleware", relativePath: "x", normalizedPath: "x" };
void invalid;
