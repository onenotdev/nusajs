import type { RouteGraph, RouteSegment } from "./route-parser.js";

/** Stable schema name of the route manifest. */
export const ROUTE_MANIFEST_NAME = "route-manifest" as const;
/** Current route-manifest schema major version. */
export const ROUTE_MANIFEST_VERSION = 2 as const;
/** Stable schema name of the security manifest. */
export const SECURITY_MANIFEST_NAME = "security-manifest" as const;
/** Current security-manifest schema major version. */
export const SECURITY_MANIFEST_VERSION = 1 as const;
/** Stable schema name of the capability manifest. */
export const CAPABILITY_MANIFEST_NAME = "capability-manifest" as const;
/** Current capability-manifest schema major version. */
export const CAPABILITY_MANIFEST_VERSION = 1 as const;

interface ManifestRouteBase {
  readonly id: string;
  readonly pattern: string;
  readonly file: string;
  readonly specificity: readonly number[];
  readonly segments: readonly Readonly<RouteSegment>[];
}

/** One renderer layout associated with a page route, ordered root to child. */
export interface ManifestLayout {
  readonly file: string;
  readonly scope: string;
}

/** A page entry with its complete root-to-child layout chain. */
export interface ManifestPageRoute extends ManifestRouteBase {
  readonly kind: "page";
  readonly layouts: readonly Readonly<ManifestLayout>[];
}

/** An endpoint entry, which never participates in layout rendering. */
export interface ManifestEndpointRoute extends ManifestRouteBase {
  readonly kind: "endpoint";
}

/** A route entry in the versioned route manifest. */
export type ManifestRoute = ManifestPageRoute | ManifestEndpointRoute;

/** Versioned route manifest (AC-ARCH-02, FW-107). */
export interface RouteManifest {
  readonly schema: typeof ROUTE_MANIFEST_NAME;
  readonly version: typeof ROUTE_MANIFEST_VERSION;
  readonly routes: readonly Readonly<ManifestRoute>[];
}

/** A security diagnostic summary: code and count only, never values. */
export interface SecurityDiagnosticSummary {
  readonly code: string;
  readonly count: number;
}

/** Input accepted by {@link createSecurityManifest}. */
export interface SecurityManifestInput {
  readonly relaxations?: readonly string[];
  readonly publicEnv?: readonly string[];
  readonly diagnostics?: readonly Readonly<SecurityDiagnosticSummary>[];
}

/**
 * Versioned security manifest (ADR-008 part 2, SEC-SECRET-002, AC-ARCH-06).
 *
 * Records the declared posture and every per-site relaxation by name only; values and secrets
 * never appear.
 */
export interface SecurityManifest {
  readonly schema: typeof SECURITY_MANIFEST_NAME;
  readonly version: typeof SECURITY_MANIFEST_VERSION;
  readonly mode: "strict";
  readonly relaxations: readonly string[];
  readonly publicEnv: readonly string[];
  readonly diagnostics: readonly Readonly<SecurityDiagnosticSummary>[];
}

/** A required runtime capability declared by one route. */
export interface RouteCapability {
  readonly route: string;
  readonly required: readonly string[];
}

/** Input accepted by {@link createCapabilityManifest}. */
export interface CapabilityManifestInput {
  readonly capabilities?: readonly Readonly<RouteCapability>[];
}

/** Versioned capability manifest. */
export interface CapabilityManifest {
  readonly schema: typeof CAPABILITY_MANIFEST_NAME;
  readonly version: typeof CAPABILITY_MANIFEST_VERSION;
  readonly capabilities: readonly Readonly<RouteCapability>[];
}

/** Any versioned manifest shape accepted by {@link assertManifestSupported}. */
export interface VersionedManifest {
  readonly schema: string;
  readonly version: number;
}

const diagnosticCodePattern = /^NUSA-[A-Z]+-\d{4}$/;
const capabilityVocabulary = new Set([
  "streaming",
  "websocket",
  "backgroundTask",
  "edgeCrypto",
  "filesystem",
  "persistentCache",
  "earlyHints"
]);
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function manifestFailure(message: string): never {
  throw new TypeError(`[NUSA-CONFIG-0001] Invalid manifest: ${message}`);
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function routeId(kind: "page" | "endpoint", pattern: string): string {
  return `r_${fnv1a(`${kind}:${pattern}`).toString(36)}`;
}

function validatedNames(names: readonly string[], label: string): readonly string[] {
  return Object.freeze(
    names.map((name) => {
      if (typeof name !== "string" || !identifierPattern.test(name)) {
        manifestFailure(`${label} entries must be identifiers, received ${typeof name}`);
      }
      return name;
    })
  );
}

/**
 * Creates the deterministic versioned route manifest from a parsed route graph.
 *
 * Route identity is derived from role and pattern so the manifest is stable across builds and
 * independent of scan order.
 */
export function createRouteManifest(graph: RouteGraph): Readonly<RouteManifest> {
  if (
    graph === null ||
    typeof graph !== "object" ||
    !Array.isArray(graph.routes) ||
    !Array.isArray(graph.boundaries)
  ) {
    manifestFailure("route graph is required");
  }
  const layouts = graph.boundaries.filter((boundary) => boundary.kind === "layout");
  const layoutBranches = new Set<string>();
  for (const layout of layouts) {
    const key = JSON.stringify(layout.branch);
    if (layoutBranches.has(key)) manifestFailure(`duplicate layout position at ${layout.scope}`);
    layoutBranches.add(key);
  }
  const appliesTo = (layoutBranch: readonly string[], routeBranch: readonly string[]): boolean =>
    layoutBranch.length <= routeBranch.length &&
    layoutBranch.every((part, index) => routeBranch[index] === part);
  return Object.freeze({
    schema: ROUTE_MANIFEST_NAME,
    version: ROUTE_MANIFEST_VERSION,
    routes: Object.freeze(
      graph.routes.map((route): Readonly<ManifestRoute> => {
        const base = {
          id: routeId(route.kind, route.pattern),
          pattern: route.pattern,
          file: route.file,
          specificity: Object.freeze([...route.specificity]),
          segments: Object.freeze(
            route.segments.map((segment: Readonly<RouteSegment>) => Object.freeze({ ...segment }))
          )
        };
        if (route.kind === "endpoint") return Object.freeze({ ...base, kind: route.kind });
        const chain = Object.freeze(
          layouts
            .filter((layout) => appliesTo(layout.branch, route.branch))
            .sort(
              (left, right) =>
                left.branch.length - right.branch.length ||
                left.file.localeCompare(right.file, "en")
            )
            .map((layout) => Object.freeze({ file: layout.file, scope: layout.scope }))
        );
        return Object.freeze({ ...base, kind: route.kind, layouts: chain });
      })
    )
  });
}

/**
 * Creates the versioned security manifest recording the declared posture (ADR-008).
 *
 * `mode` is `"strict"` and cannot be changed by this API; every per-site relaxation and declared
 * public environment variable is recorded by name only, so the manifest never carries secrets.
 */
export function createSecurityManifest(input?: SecurityManifestInput): Readonly<SecurityManifest> {
  const options = input ?? {};
  if (options === null || typeof options !== "object") manifestFailure("input must be an object");
  const relaxations = validatedNames(options.relaxations ?? [], "relaxations");
  const publicEnv = validatedNames(options.publicEnv ?? [], "publicEnv");
  const diagnostics = Object.freeze(
    (options.diagnostics ?? []).map((entry) => {
      if (
        entry === null ||
        typeof entry !== "object" ||
        typeof entry.code !== "string" ||
        !diagnosticCodePattern.test(entry.code) ||
        !Number.isInteger(entry.count) ||
        entry.count < 0
      ) {
        manifestFailure("diagnostics entries require a NUSA-* code and a non-negative count");
      }
      return Object.freeze({ code: entry.code, count: entry.count });
    })
  );
  return Object.freeze({
    schema: SECURITY_MANIFEST_NAME,
    version: SECURITY_MANIFEST_VERSION,
    mode: "strict",
    relaxations,
    publicEnv,
    diagnostics
  });
}

/**
 * Creates the versioned capability manifest from per-route required capabilities.
 */
export function createCapabilityManifest(
  input?: CapabilityManifestInput
): Readonly<CapabilityManifest> {
  const options = input ?? {};
  if (options === null || typeof options !== "object") manifestFailure("input must be an object");
  const capabilities = Object.freeze(
    (options.capabilities ?? []).map((entry) => {
      if (entry === null || typeof entry !== "object" || typeof entry.route !== "string") {
        manifestFailure("capability entries require a route pattern");
      }
      const required = entry.required.map((name) => {
        if (typeof name !== "string" || !capabilityVocabulary.has(name)) {
          manifestFailure(`unsupported capability ${JSON.stringify(name)}`);
        }
        return name;
      });
      return Object.freeze({ route: entry.route, required: Object.freeze(required) });
    })
  );
  return Object.freeze({
    schema: CAPABILITY_MANIFEST_NAME,
    version: CAPABILITY_MANIFEST_VERSION,
    capabilities
  });
}

/**
 * Rejects a manifest whose schema name differs or whose major version is unsupported.
 *
 * Adapters and tooling call this before consuming a manifest so a future major schema version
 * fails loudly instead of being misread.
 */
export function assertManifestSupported(
  manifest: Readonly<VersionedManifest>,
  expectedSchema: string,
  supportedMajor: number
): void {
  if (manifest === null || typeof manifest !== "object") manifestFailure("manifest is required");
  if (!Number.isInteger(supportedMajor) || supportedMajor < 1) {
    manifestFailure("supportedMajor must be a positive integer");
  }
  if (manifest.schema !== expectedSchema) {
    manifestFailure(
      `expected schema ${JSON.stringify(expectedSchema)}, received ${JSON.stringify(manifest.schema)}`
    );
  }
  if (!Number.isInteger(manifest.version) || manifest.version < 1) {
    manifestFailure("manifest version must be a positive integer");
  }
  if (manifest.version > supportedMajor) {
    manifestFailure(
      `${manifest.schema} major version ${manifest.version} is not supported by this consumer (max ${supportedMajor})`
    );
  }
}
