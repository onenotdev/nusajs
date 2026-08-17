/**
 * Security-header primitives (FW-124, SEC-HEADER-001/002/003, SEC-CACHE-004).
 *
 * `createSecurityHeaders()` builds an explicit, deterministic security header set. The framework
 * imposes no policy by default; every helper is opt-in so an application's actual policy is always
 * inspectable. `mergeSecurityHeaders()` merges a parent (platform/strict) set with a child set,
 * keeps the stricter parent value on scalar conflict, unions Content-Security-Policy directives,
 * and reports every conflict instead of silently weakening a policy.
 */

/** Values accepted for the `Referrer-Policy` header. */
export type ReferrerPolicyValue =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url";

/** Values accepted for the legacy `X-Frame-Options` header. */
export type FrameOptionsValue = "DENY" | "SAMEORIGIN";

/** Values accepted for the `Cross-Origin-Opener-Policy` header. */
export type CoopValue = "same-origin" | "same-origin-allow-popups";

/** Values accepted for the `Cross-Origin-Resource-Policy` header. */
export type CorpValue = "same-origin" | "same-site" | "cross-origin";

/** Canonical, deterministic `Content-Security-Policy` directive order. */
const cspDirectiveOrder = [
  "default-src",
  "script-src",
  "style-src",
  "img-src",
  "connect-src",
  "font-src",
  "object-src",
  "base-uri",
  "frame-ancestors",
  "frame-src",
  "form-action",
  "worker-src",
  "manifest-src",
  "media-src",
  "child-src",
  "report-uri",
  "report-to",
  "upgrade-insecure-requests"
] as const;

/** A supported `Content-Security-Policy` directive name. */
export type CspDirectiveName = (typeof cspDirectiveOrder)[number];

/**
 * Content-Security-Policy directives. Values are raw CSP tokens such as `"'self'"` or
 * `"'nonce-abc'"`; `upgrade-insecure-requests` accepts `true`.
 */
export type CspDirectives = Partial<Record<CspDirectiveName, readonly string[] | true>>;

/** Options accepted by {@link createSecurityHeaders}. */
export interface SecurityHeaderOptions {
  /** Content-Security-Policy directives. */
  readonly csp?: CspDirectives;
  /** Strict-Transport-Security policy. */
  readonly hsts?: HstsOptions;
  /** `X-Content-Type-Options`. */
  readonly contentTypeOptions?: "nosniff";
  /** `Referrer-Policy` value. */
  readonly referrerPolicy?: ReferrerPolicyValue;
  /** Legacy `X-Frame-Options` value. */
  readonly frameOptions?: FrameOptionsValue;
  /** `Permissions-Policy` feature allowlists. */
  readonly permissionsPolicy?: Readonly<Record<string, readonly string[]>>;
  /** Cross-origin isolation headers. */
  readonly crossOriginIsolation?: CrossOriginIsolationOptions;
  /** `Cache-Control` value. */
  readonly cacheControl?: string;
}

/** Strict-Transport-Security policy. */
export interface HstsOptions {
  /** `max-age` in seconds. */
  readonly maxAge: number;
  /** Includes `includeSubDomains`. */
  readonly includeSubDomains?: boolean;
  /** Includes `preload`. */
  readonly preload?: boolean;
}

/** Cross-origin isolation (`Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`). */
export interface CrossOriginIsolationOptions {
  readonly coop: CoopValue;
  readonly corp: CorpValue;
}

/** A deterministic security-header merge conflict. */
export interface SecurityHeaderConflict {
  readonly name: string;
  readonly parentValue: string;
  readonly childValue: string;
  readonly reason: "scalar" | "csp-directive";
}

/** The deterministic result of merging a child header set into a parent set. */
export interface SecurityHeaderMergeResult {
  readonly headers: Headers;
  readonly conflicts: readonly Readonly<SecurityHeaderConflict>[];
}

/** The canonical serialization order of emitted security headers. */
const emissionOrder = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "x-frame-options",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "cache-control"
] as const;

const permissionsPolicyAllowlist = new Set([
  "camera",
  "display-capture",
  "encrypted-media",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "picture-in-picture",
  "usb",
  "web-share",
  "xr-spatial-tracking"
]);

function invalidHeader(reason: string): never {
  throw new TypeError(`[NUSA-SECURITY-0001] Invalid security header: ${reason}`);
}

function assertSafeValue(value: string, name: string): void {
  if (value.length === 0) invalidHeader(`${name} value cannot be empty`);
  if (/[\r\n]/.test(value)) invalidHeader(`${name} value cannot contain line breaks`);
}

const cspDirectiveNames = new Set<string>(cspDirectiveOrder);

function serializeCsp(directives: CspDirectives): string {
  for (const name of Object.keys(directives)) {
    if (!cspDirectiveNames.has(name)) invalidHeader(`unknown csp directive ${name}`);
  }
  const parts: string[] = [];
  for (const name of cspDirectiveOrder) {
    const value = directives[name];
    if (value === undefined) continue;
    if (value === true) {
      parts.push(name);
      continue;
    }
    if (value.length === 0) invalidHeader(`csp directive ${name} requires at least one value`);
    for (const token of value) {
      if (typeof token !== "string" || token.length === 0) {
        invalidHeader(`csp directive ${name} values must be non-empty strings`);
      }
      assertSafeValue(token, `csp directive ${name}`);
      if (token.includes(";")) invalidHeader(`csp directive ${name} value cannot contain ';'`);
    }
    parts.push(`${name} ${value.join(" ")}`);
  }
  return parts.join("; ");
}

function serializePermissionsPolicy(policy: Readonly<Record<string, readonly string[]>>): string {
  const parts: string[] = [];
  for (const [name, allowlist] of Object.entries(policy)) {
    if (!permissionsPolicyAllowlist.has(name))
      invalidHeader(`unknown permissions-policy feature ${name}`);
    if (!Array.isArray(allowlist)) invalidHeader(`permissions-policy ${name} must be an array`);
    const values = allowlist.map((value) => {
      if (typeof value !== "string")
        invalidHeader(`permissions-policy ${name} values must be strings`);
      assertSafeValue(value, `permissions-policy ${name}`);
      return value;
    });
    parts.push(values.length === 0 ? `${name}=()` : `${name}=(${values.join(" ")})`);
  }
  return parts.join("; ");
}

function hstsValue(options: HstsOptions): string {
  if (!Number.isInteger(options.maxAge) || options.maxAge < 0) {
    invalidHeader("hsts maxAge must be a non-negative integer");
  }
  const parts = [`max-age=${options.maxAge}`];
  if (options.includeSubDomains === true) parts.push("includeSubDomains");
  if (options.preload === true) parts.push("preload");
  return parts.join("; ");
}

/**
 * Creates a security header set from explicit options with deterministic value serialization.
 *
 * Every value is validated against line-break injection and unknown directive names, so a typo
 * cannot silently weaken a policy. CSP directives and permissions-policy features serialize in a
 * fixed canonical order; the final header iteration order follows the host platform's `Headers`
 * implementation.
 */
export function createSecurityHeaders(options: SecurityHeaderOptions): Headers {
  if (options === null || typeof options !== "object") invalidHeader("options must be an object");
  const entries: (readonly [string, string])[] = [];
  if (options.csp !== undefined) {
    const value = serializeCsp(options.csp);
    if (value !== "") entries.push(["content-security-policy", value]);
  }
  if (options.hsts !== undefined)
    entries.push(["strict-transport-security", hstsValue(options.hsts)]);
  if (options.contentTypeOptions !== undefined) {
    assertSafeValue(options.contentTypeOptions, "x-content-type-options");
    entries.push(["x-content-type-options", options.contentTypeOptions]);
  }
  if (options.referrerPolicy !== undefined) {
    assertSafeValue(options.referrerPolicy, "referrer-policy");
    entries.push(["referrer-policy", options.referrerPolicy]);
  }
  if (options.frameOptions !== undefined) {
    assertSafeValue(options.frameOptions, "x-frame-options");
    entries.push(["x-frame-options", options.frameOptions]);
  }
  if (options.permissionsPolicy !== undefined) {
    entries.push(["permissions-policy", serializePermissionsPolicy(options.permissionsPolicy)]);
  }
  if (options.crossOriginIsolation !== undefined) {
    assertSafeValue(options.crossOriginIsolation.coop, "cross-origin-opener-policy");
    assertSafeValue(options.crossOriginIsolation.corp, "cross-origin-resource-policy");
    entries.push(["cross-origin-opener-policy", options.crossOriginIsolation.coop]);
    entries.push(["cross-origin-resource-policy", options.crossOriginIsolation.corp]);
  }
  if (options.cacheControl !== undefined) {
    assertSafeValue(options.cacheControl, "cache-control");
    entries.push(["cache-control", options.cacheControl]);
  }
  const ordered = emissionOrder
    .map((name) => entries.find(([entryName]) => entryName === name))
    .filter((entry) => entry !== undefined) as readonly (readonly [string, string])[];
  const headers = new Headers();
  for (const [name, value] of ordered) headers.set(name, value);
  return headers;
}

function mergeCsp(
  parent: string,
  child: string
): {
  readonly value: string;
  readonly conflict: SecurityHeaderConflict | undefined;
} {
  const parse = (value: string): ReadonlyMap<string, readonly string[]> => {
    const directives = new Map<string, string[]>();
    for (const part of value.split(";")) {
      const trimmed = part.trim();
      if (trimmed === "") continue;
      const [name, ...tokens] = trimmed.split(/\s+/);
      if (name === undefined) continue;
      directives.set(name, [...(directives.get(name) ?? []), ...tokens]);
    }
    return directives;
  };
  const parentDirectives = parse(parent);
  const childDirectives = parse(child);
  const merged = new Map<string, string[]>();
  for (const [name, tokens] of parentDirectives) merged.set(name, [...tokens]);
  for (const [name, childTokens] of childDirectives) {
    const parentTokens = merged.get(name);
    if (parentTokens === undefined) {
      merged.set(name, [...childTokens]);
      continue;
    }
    // Adding any token to an existing directive widens what the policy allows, which
    // would silently weaken the stricter parent. Keep the parent directive and report.
    const parentSet = new Set(parentTokens);
    const childOnly = childTokens.filter((token) => !parentSet.has(token));
    if (childOnly.length > 0) {
      return {
        value: serializeCspMap(merged),
        conflict: {
          name: "content-security-policy",
          parentValue: parent,
          childValue: child,
          reason: "csp-directive"
        }
      };
    }
  }
  return { value: serializeCspMap(merged), conflict: undefined };
}

function serializeCspMap(directives: ReadonlyMap<string, readonly string[]>): string {
  return [...directives.entries()]
    .map(([name, tokens]) => `${name} ${tokens.join(" ")}`)
    .join("; ");
}

/**
 * Merges a child header set into a parent set without silently weakening a stricter policy.
 *
 * Identical values are kept once; scalar conflicts keep the parent value and are reported; CSP
 * headers are merged at directive level, unioning compatible values and reporting incompatible
 * ones. New child headers are appended in child order. The result is deterministic.
 */
export function mergeSecurityHeaders(parent: Headers, child: Headers): SecurityHeaderMergeResult {
  if (!(parent instanceof Headers) || !(child instanceof Headers)) {
    invalidHeader("mergeSecurityHeaders requires Headers instances");
  }
  const headers = new Headers();
  const conflicts: SecurityHeaderConflict[] = [];
  const parentNames = new Set<string>();
  parent.forEach((value, name) => {
    parentNames.add(name.toLowerCase());
    headers.set(name, value);
  });
  child.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (!parentNames.has(lower)) {
      headers.set(name, value);
      return;
    }
    const parentValue = parent.get(name);
    if (parentValue === value) return;
    if (lower === "content-security-policy" && parentValue !== null) {
      const merged = mergeCsp(parentValue, value);
      headers.set(name, merged.value);
      if (merged.conflict !== undefined) conflicts.push(merged.conflict);
      return;
    }
    conflicts.push({ name, parentValue: parentValue ?? "", childValue: value, reason: "scalar" });
  });
  return Object.freeze({ headers, conflicts: Object.freeze(conflicts) });
}

/**
 * Merges a child header set into a parent set and throws on any conflict.
 *
 * Use when a weakening or divergent child policy must fail the response rather than be resolved
 * heuristically.
 */
export function mergeSecurityHeadersStrict(parent: Headers, child: Headers): Headers {
  const result = mergeSecurityHeaders(parent, child);
  if (result.conflicts.length > 0) {
    const first = result.conflicts[0];
    const detail =
      first === undefined ? "" : ` (${first.name}: ${first.parentValue} vs ${first.childValue})`;
    throw new TypeError(`[NUSA-SECURITY-0001] Security header merge conflict${detail}`);
  }
  return result.headers;
}
