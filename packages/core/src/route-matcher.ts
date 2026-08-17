/** Semantic route segment kinds accepted from the compiler route graph. */
export type MatchRouteSegmentKind =
  | "static"
  | "dynamic"
  | "optional"
  | "catch-all"
  | "optional-catch-all";

/** Structurally compatible immutable segment consumed by the universal matcher. */
export interface MatchRouteSegment {
  readonly kind: MatchRouteSegmentKind;
  readonly value: string;
}

/** Structurally compatible page or endpoint route consumed by the universal matcher. */
export interface MatchRoute {
  readonly kind: "page" | "endpoint";
  readonly pattern: string;
  readonly segments: readonly Readonly<MatchRouteSegment>[];
  readonly specificity: readonly number[];
  readonly file: string;
}

/** Immutable successful route match. */
export interface RouteMatch<Route extends MatchRoute = MatchRoute> {
  readonly route: Readonly<Route>;
  readonly params: Readonly<Record<string, string>>;
}

/** A reusable universal matcher compiled from an immutable route list. */
export interface RouteMatcher<Route extends MatchRoute = MatchRoute> {
  readonly routes: readonly Readonly<Route>[];
  readonly match: (
    pathname: string,
    kind: MatchRoute["kind"]
  ) => Readonly<RouteMatch<Route>> | undefined;
}

const maxPathnameLength = 8192;
const maxPathSegments = 256;
const parameterNamePattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const encodedSeparatorPattern = /%(?:2f|5c)/i;
const percentEscapePattern = /%(?![0-9a-fA-F]{2})/;
const scores: Readonly<Record<MatchRouteSegmentKind, number>> = Object.freeze({
  "optional-catch-all": 0,
  "catch-all": 1,
  optional: 2,
  dynamic: 3,
  static: 4
});

function invalidRoute(reason: string): never {
  throw new TypeError(`[NUSA-ROUTE-0001] Invalid matcher route: ${reason}`);
}

function hasControlOrSeparator(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127 || character === "/" || character === "\\";
  });
}

function compareRoutes(left: MatchRoute, right: MatchRoute): number {
  const length = Math.max(left.specificity.length, right.specificity.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (right.specificity[index] ?? -1) - (left.specificity[index] ?? -1);
    if (difference !== 0) return difference;
  }
  return (
    left.pattern.localeCompare(right.pattern, "en") || left.file.localeCompare(right.file, "en")
  );
}

function validateRoute(route: MatchRoute): void {
  if (route.kind !== "page" && route.kind !== "endpoint") invalidRoute("unknown route role");
  if (!route.pattern.startsWith("/") || route.file.length === 0)
    invalidRoute("pattern and file are required");
  if (route.segments.length > maxPathSegments || route.specificity.length !== route.segments.length)
    invalidRoute("segment and specificity lengths must agree within limits");
  const names = new Set<string>();
  for (const [index, segment] of route.segments.entries()) {
    if (!(segment.kind in scores)) invalidRoute("unknown segment kind");
    if (route.specificity[index] !== scores[segment.kind])
      invalidRoute("specificity must be derived from segment kinds");
    if (segment.kind === "static") {
      if (
        segment.value.length === 0 ||
        segment.value !== segment.value.normalize("NFC") ||
        segment.value === "." ||
        segment.value === ".." ||
        segment.value.includes("%") ||
        hasControlOrSeparator(segment.value)
      ) {
        invalidRoute("unsafe static segment");
      }
    } else {
      if (!parameterNamePattern.test(segment.value) || names.has(segment.value))
        invalidRoute("parameter names must be valid and unique");
      names.add(segment.value);
    }
    if (
      (segment.kind === "catch-all" || segment.kind === "optional-catch-all") &&
      index !== route.segments.length - 1
    ) {
      invalidRoute("catch-all segment must be final");
    }
  }
}

function normalizePathname(pathname: string): readonly string[] | undefined {
  if (
    pathname.length === 0 ||
    pathname.length > maxPathnameLength ||
    !pathname.startsWith("/") ||
    pathname.includes("?") ||
    pathname.includes("#") ||
    pathname.includes("\\") ||
    pathname.includes("//") ||
    (pathname.length > 1 && pathname.endsWith("/"))
  ) {
    return undefined;
  }
  if (pathname === "/") return Object.freeze([]);
  const rawSegments = pathname.slice(1).split("/");
  if (rawSegments.length > maxPathSegments) return undefined;
  const normalized: string[] = [];
  for (const rawSegment of rawSegments) {
    if (percentEscapePattern.test(rawSegment) || encodedSeparatorPattern.test(rawSegment))
      return undefined;
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawSegment);
    } catch {
      return undefined;
    }
    if (
      decoded === "." ||
      decoded === ".." ||
      hasControlOrSeparator(decoded) ||
      encodedSeparatorPattern.test(decoded)
    ) {
      return undefined;
    }
    normalized.push(decoded.normalize("NFC"));
  }
  return Object.freeze(normalized);
}

function matchSegments(
  routeSegments: readonly Readonly<MatchRouteSegment>[],
  pathSegments: readonly string[]
): Readonly<Record<string, string>> | undefined {
  const failedStates = new Set<string>();
  function walk(
    routeIndex: number,
    pathIndex: number,
    params: Readonly<Record<string, string>>
  ): Readonly<Record<string, string>> | undefined {
    const state = `${routeIndex}:${pathIndex}`;
    if (failedStates.has(state)) return undefined;
    if (routeIndex === routeSegments.length) {
      if (pathIndex === pathSegments.length) return Object.freeze(params);
      failedStates.add(state);
      return undefined;
    }
    const segment = routeSegments[routeIndex];
    if (segment === undefined) return undefined;
    const pathSegment = pathSegments[pathIndex];
    if (segment.kind === "static") {
      if (pathSegment === segment.value) {
        const result = walk(routeIndex + 1, pathIndex + 1, params);
        if (result !== undefined) return result;
      }
      failedStates.add(state);
      return undefined;
    }
    if (segment.kind === "catch-all" || segment.kind === "optional-catch-all") {
      if (pathIndex === pathSegments.length) {
        if (segment.kind === "catch-all") return undefined;
        return Object.freeze(params);
      }
      return Object.freeze(
        Object.assign(Object.create(null) as Record<string, string>, params, {
          [segment.value]: pathSegments.slice(pathIndex).join("/")
        })
      );
    }
    if (pathSegment === undefined) {
      if (segment.kind === "optional") {
        const result = walk(routeIndex + 1, pathIndex, params);
        if (result !== undefined) return result;
      }
      failedStates.add(state);
      return undefined;
    }
    const consumed = Object.assign(Object.create(null) as Record<string, string>, params, {
      [segment.value]: pathSegment
    });
    const consumedMatch = walk(routeIndex + 1, pathIndex + 1, consumed);
    if (consumedMatch !== undefined || segment.kind === "dynamic") return consumedMatch;
    const skippedMatch = walk(routeIndex + 1, pathIndex, params);
    if (skippedMatch !== undefined) return skippedMatch;
    failedStates.add(state);
    return undefined;
  }
  return walk(0, 0, Object.create(null) as Record<string, string>);
}

/**
 * Creates a reusable universal matcher from compiler-produced route records.
 *
 * The matcher accepts only a raw pathname beginning with `/`. It rejects malformed escapes,
 * separators, dot segments, duplicate or non-root trailing slashes, controls, query/fragment
 * syntax, paths above 8 KiB, and paths above 256 segments. Decoded segments are normalized to NFC
 * and static comparisons remain case-sensitive.
 *
 * @param routes - Structurally compatible parsed routes with parser-derived specificity keys.
 */
export function createRouteMatcher<Route extends MatchRoute>(
  routes: readonly Readonly<Route>[]
): Readonly<RouteMatcher<Route>> {
  if (routes.length > 100_000) invalidRoute("route count exceeds 100,000");
  for (const route of routes) validateRoute(route);
  const sortedRoutes = Object.freeze([...routes].sort(compareRoutes));
  return Object.freeze({
    routes: sortedRoutes,
    match(pathname: string, kind: MatchRoute["kind"]): Readonly<RouteMatch<Route>> | undefined {
      if (kind !== "page" && kind !== "endpoint") return undefined;
      const pathSegments = normalizePathname(pathname);
      if (pathSegments === undefined) return undefined;
      for (const route of sortedRoutes) {
        if (route.kind !== kind) continue;
        const params = matchSegments(route.segments, pathSegments);
        if (params !== undefined) return Object.freeze({ route, params });
      }
      return undefined;
    }
  });
}
