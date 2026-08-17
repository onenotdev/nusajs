import type { RouteFileRecord, RouteScanDiagnostic } from "./route-scanner.js";

/** Semantic kinds supported by filesystem route segments. */
export type RouteSegmentKind =
  | "static"
  | "dynamic"
  | "optional"
  | "catch-all"
  | "optional-catch-all";

/** A parsed URL segment. */
export interface RouteSegment {
  readonly kind: RouteSegmentKind;
  readonly value: string;
}

/** A parsed page or endpoint route. */
export interface ParsedRoute {
  readonly kind: "page" | "endpoint";
  readonly pattern: string;
  readonly collisionKey: string;
  readonly segments: readonly Readonly<RouteSegment>[];
  readonly specificity: readonly number[];
  readonly file: string;
}

/** A parsed layout, error, or loading boundary and its URL scope. */
export interface RouteBoundary {
  readonly kind: "layout" | "error" | "loading";
  readonly scope: string;
  readonly file: string;
}

/** A deterministic collision naming every conflicting source file. */
export interface RouteCollision {
  readonly kind: "same-pattern" | "shadowed-pattern";
  readonly key: string;
  readonly files: readonly string[];
}

/** Immutable output consumed by later manifest and matcher stages. */
export interface RouteGraph {
  readonly routes: readonly Readonly<ParsedRoute>[];
  readonly boundaries: readonly Readonly<RouteBoundary>[];
}

/** Aggregate route grammar or collision failure. */
export class RouteParseError extends Error {
  readonly diagnostics: readonly Readonly<RouteScanDiagnostic>[];

  constructor(diagnostics: readonly RouteScanDiagnostic[]) {
    super("[NUSA-ROUTE-0001] Route parsing failed");
    this.name = "RouteParseError";
    this.diagnostics = Object.freeze(diagnostics.map((item) => Object.freeze(item)));
  }
}

const extensionPattern = /\.(?:ts|tsx|js|jsx|mts|mjs|cts|cjs)$/;
const routeSuffixPattern = /\.(?:page|endpoint)$/;
const groupPattern = /^\([^()]+\)$/;
const parameterNamePattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function routeDiagnostic(message: string, file: string, hint: string): RouteScanDiagnostic {
  return { code: "NUSA-ROUTE-0001", message, file, hint };
}

function parseSegment(raw: string): RouteSegment | undefined {
  if (raw.startsWith("[[...") && raw.endsWith("]]")) {
    const value = raw.slice(5, -2);
    return parameterNamePattern.test(value) ? { kind: "optional-catch-all", value } : undefined;
  }
  if (raw.startsWith("[...") && raw.endsWith("]")) {
    const value = raw.slice(4, -1);
    return parameterNamePattern.test(value) ? { kind: "catch-all", value } : undefined;
  }
  if (raw.startsWith("[[") && raw.endsWith("]]")) {
    const value = raw.slice(2, -2);
    return parameterNamePattern.test(value) ? { kind: "optional", value } : undefined;
  }
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const value = raw.slice(1, -1);
    return parameterNamePattern.test(value) ? { kind: "dynamic", value } : undefined;
  }
  if (raw.includes("[") || raw.includes("]") || raw.length === 0) return undefined;
  return { kind: "static", value: raw };
}

function renderedSegment(segment: RouteSegment): string {
  if (segment.kind === "dynamic") return `[${segment.value}]`;
  if (segment.kind === "optional") return `[[${segment.value}]]`;
  if (segment.kind === "catch-all") return `[...${segment.value}]`;
  if (segment.kind === "optional-catch-all") return `[[...${segment.value}]]`;
  return segment.value;
}

function score(segment: RouteSegment): number {
  return { "optional-catch-all": 0, "catch-all": 1, optional: 2, dynamic: 3, static: 4 }[
    segment.kind
  ];
}

function collisionSegment(segment: RouteSegment): string {
  return {
    "optional-catch-all": "[[...]]",
    "catch-all": "[...]",
    optional: "[[]]",
    dynamic: "[]",
    static: segment.value.toLocaleLowerCase("en-US").normalize("NFC")
  }[segment.kind];
}

function compareSpecificity(left: ParsedRoute, right: ParsedRoute): number {
  const length = Math.max(left.specificity.length, right.specificity.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (right.specificity[index] ?? -1) - (left.specificity[index] ?? -1);
    if (difference !== 0) return difference;
  }
  return (
    left.pattern.localeCompare(right.pattern, "en") || left.file.localeCompare(right.file, "en")
  );
}

function shadowKeys(segments: readonly RouteSegment[]): readonly string[] {
  const keys = new Set<string>();
  function walk(index: number, parts: readonly string[]): void {
    if (index === segments.length) {
      keys.add(`/${parts.join("/")}`.replace(/\/+$/, "") || "/");
      return;
    }
    const segment = segments[index];
    if (segment === undefined) return;
    if (segment.kind === "optional" || segment.kind === "optional-catch-all")
      walk(index + 1, parts);
    walk(index + 1, [...parts, collisionSegment(segment)]);
  }
  walk(0, []);
  return [...keys];
}

function parseParts(record: RouteFileRecord): readonly string[] {
  const pathParts = record.normalizedPath.split("/");
  const filename = pathParts.pop() ?? "";
  if (record.kind === "page" || record.kind === "endpoint") {
    const stem = filename.replace(extensionPattern, "").replace(routeSuffixPattern, "");
    if (stem !== "index") pathParts.push(stem);
  }
  return pathParts.filter((part) => !groupPattern.test(part));
}

/** Parses normalized scanner records and rejects every ambiguous URL graph. */
export function parseRouteGraph(records: readonly RouteFileRecord[]): Readonly<RouteGraph> {
  const routes: ParsedRoute[] = [];
  const boundaries: RouteBoundary[] = [];
  const diagnostics: RouteScanDiagnostic[] = [];

  for (const record of records) {
    const rawParts = parseParts(record);
    const parsed = rawParts.map(parseSegment);
    const invalidIndex = parsed.indexOf(undefined);
    if (invalidIndex >= 0) {
      diagnostics.push(
        routeDiagnostic(
          `Invalid route segment: ${rawParts[invalidIndex] ?? ""}`,
          record.relativePath,
          "Use a static, [param], [[param]], [...param], [[...param]], or (group) segment"
        )
      );
      continue;
    }
    const segments = parsed as RouteSegment[];
    const catchAllIndex = segments.findIndex(
      (segment) => segment.kind === "catch-all" || segment.kind === "optional-catch-all"
    );
    if (catchAllIndex >= 0 && catchAllIndex !== segments.length - 1) {
      diagnostics.push(
        routeDiagnostic(
          "Catch-all segments must be final",
          record.relativePath,
          "Move the catch-all segment to the end of the route"
        )
      );
      continue;
    }
    const pattern = `/${segments.map(renderedSegment).join("/")}`.replace(/\/+$/, "") || "/";
    if (record.kind === "layout" || record.kind === "error" || record.kind === "loading") {
      boundaries.push(
        Object.freeze({ kind: record.kind, scope: pattern, file: record.relativePath })
      );
    } else {
      const frozenSegments = Object.freeze(segments.map((segment) => Object.freeze(segment)));
      routes.push(
        Object.freeze({
          kind: record.kind,
          pattern,
          collisionKey: `/${segments.map(collisionSegment).join("/")}`.replace(/\/+$/, "") || "/",
          segments: frozenSegments,
          specificity: Object.freeze(segments.map(score)),
          file: record.relativePath
        })
      );
    }
  }

  const conflicts = new Map<string, Set<string>>();
  const samePatterns = new Map<string, string[]>();
  for (const route of routes) {
    const identity = `${route.kind}\0${route.collisionKey}`;
    const files = samePatterns.get(identity) ?? [];
    files.push(route.file);
    samePatterns.set(identity, files);
  }
  for (const [identity, files] of samePatterns) {
    const key = identity.slice(identity.indexOf("\0") + 1);
    if (files.length > 1) conflicts.set(`same-pattern\0${key}`, new Set(files));
  }
  const shadows = new Map<string, Set<string>>();
  for (const route of routes) {
    for (const key of shadowKeys(route.segments)) {
      const identity = `${route.kind}\0${key}`;
      const files = shadows.get(identity) ?? new Set<string>();
      files.add(route.file);
      shadows.set(identity, files);
    }
  }
  for (const [identity, files] of shadows) {
    const key = identity.slice(identity.indexOf("\0") + 1);
    if (
      files.size > 1 &&
      ![...conflicts.values()].some((existing) => [...files].every((file) => existing.has(file)))
    ) {
      conflicts.set(`shadowed-pattern\0${key}`, files);
    }
  }
  for (const [identity, files] of conflicts) {
    const [kind, key] = identity.split("\0") as [RouteCollision["kind"], string];
    const sortedFiles = [...files].sort((left, right) => left.localeCompare(right, "en"));
    for (const file of sortedFiles) {
      diagnostics.push(
        routeDiagnostic(
          `${kind} collision at ${key}: ${sortedFiles.join(", ")}`,
          file,
          "Rename or restructure every conflicting route"
        )
      );
    }
  }
  diagnostics.sort((left, right) =>
    `${left.file}\0${left.message}`.localeCompare(`${right.file}\0${right.message}`, "en")
  );
  if (diagnostics.length > 0) throw new RouteParseError(diagnostics);
  routes.sort(compareSpecificity);
  boundaries.sort(
    (left, right) =>
      left.scope.localeCompare(right.scope, "en") || left.kind.localeCompare(right.kind, "en")
  );
  return Object.freeze({ routes: Object.freeze(routes), boundaries: Object.freeze(boundaries) });
}
