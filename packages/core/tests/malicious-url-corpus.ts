/**
 * Shared malicious raw-pathname corpus (FW-118 / AC-ROUTE-07, SEC-INPUT-003).
 *
 * Every case names a raw pathname string and whether a conforming universal matcher must
 * reject it even against a catch-all route. The corpus is the single reference used by the
 * matcher suite and by every official adapter conformance suite, so normalization behavior
 * stays identical across adapters. Query and fragment syntax are rejections of the raw string
 * only: an HTTP adapter splits them at the transport layer before the pipeline.
 */

/** One raw-pathname corpus case. */
export interface RawPathnameCase {
  readonly name: string;
  /** The raw pathname string exactly as a matcher or adapter may receive it. */
  readonly pathname: string;
  /** True when every conforming matcher must fail closed (no match) for this pathname. */
  readonly mustReject: boolean;
  /** False when no HTTP client can transport the raw string; matcher-only coverage. */
  readonly transportable: boolean;
}

const rawCases: readonly RawPathnameCase[] = [
  // Structural violations.
  { name: "empty pathname", pathname: "", mustReject: true, transportable: false },
  { name: "missing leading slash", pathname: "about", mustReject: true, transportable: false },
  {
    name: "absolute-form target",
    pathname: "https://example.test/about",
    mustReject: true,
    transportable: false
  },
  { name: "protocol-relative", pathname: "//about", mustReject: true, transportable: true },
  { name: "query syntax", pathname: "/about?x=1", mustReject: true, transportable: true },
  { name: "fragment syntax", pathname: "/about#part", mustReject: true, transportable: true },
  { name: "duplicate slash", pathname: "/a//b", mustReject: true, transportable: true },
  { name: "trailing slash", pathname: "/about/", mustReject: true, transportable: true },
  { name: "literal backslash", pathname: "/a\\b", mustReject: true, transportable: true },

  // Malformed and hostile percent escapes.
  { name: "lone percent", pathname: "/%", mustReject: true, transportable: true },
  { name: "truncated escape", pathname: "/%2", mustReject: true, transportable: true },
  { name: "non-hex escape", pathname: "/%GG", mustReject: true, transportable: true },
  { name: "encoded slash lowercase", pathname: "/%2f", mustReject: true, transportable: true },
  { name: "encoded slash uppercase", pathname: "/%2F", mustReject: true, transportable: true },
  { name: "encoded backslash", pathname: "/%5c", mustReject: true, transportable: true },
  { name: "encoded backslash uppercase", pathname: "/%5C", mustReject: true, transportable: true },
  { name: "double-encoded slash", pathname: "/%252f", mustReject: true, transportable: true },
  { name: "double-encoded backslash", pathname: "/%255c", mustReject: true, transportable: true },
  { name: "encoded duplicate slash", pathname: "/%2f%2f", mustReject: true, transportable: true },
  {
    name: "encoded slash inside segment",
    pathname: "/blog%2Fadmin",
    mustReject: true,
    transportable: true
  },
  { name: "overlong UTF-8", pathname: "/%C0%AF", mustReject: true, transportable: true },
  { name: "lone UTF-8 surrogate", pathname: "/%ED%A0%80", mustReject: true, transportable: true },
  { name: "encoded null byte", pathname: "/%00", mustReject: true, transportable: true },
  { name: "encoded unit separator", pathname: "/%1f", mustReject: true, transportable: true },
  { name: "encoded DEL", pathname: "/%7f", mustReject: true, transportable: true },

  // Dot segments and traversal.
  { name: "dot segment", pathname: "/.", mustReject: true, transportable: true },
  { name: "dot-dot segment", pathname: "/..", mustReject: true, transportable: true },
  { name: "encoded dot", pathname: "/%2e", mustReject: true, transportable: true },
  { name: "encoded dot-dot", pathname: "/%2E%2e", mustReject: true, transportable: true },
  { name: "traversal with slash", pathname: "/x/../y", mustReject: true, transportable: true },
  { name: "encoded traversal", pathname: "/%2e%2e/x", mustReject: true, transportable: true },

  // Raw controls (not transportable over HTTP).
  { name: "raw null byte", pathname: "/\u0000", mustReject: true, transportable: false },
  { name: "raw control character", pathname: "/a\u0001b", mustReject: true, transportable: false },

  // Valid UTF-8 and encodings that must still match.
  { name: "root", pathname: "/", mustReject: false, transportable: true },
  { name: "single segment", pathname: "/a", mustReject: false, transportable: true },
  { name: "nested segments", pathname: "/a/b", mustReject: false, transportable: true },
  // Raw non-ASCII bytes cannot travel in an HTTP request line; conforming clients
  // percent-encode, so this case is matcher-only and the encoded forms below cover transport.
  { name: "raw UTF-8", pathname: "/café", mustReject: false, transportable: false },
  { name: "NFD encoded", pathname: "/cafe%CC%81", mustReject: false, transportable: true },
  { name: "encoded checkmark", pathname: "/%E2%9C%93", mustReject: false, transportable: true },
  { name: "four-byte UTF-8", pathname: "/%F0%9F%98%80", mustReject: false, transportable: true },
  { name: "encoded space", pathname: "/a%20b", mustReject: false, transportable: true },
  { name: "encoded ampersand", pathname: "/%26", mustReject: false, transportable: true },
  { name: "encoded question mark", pathname: "/%3F", mustReject: false, transportable: true },
  { name: "encoded hash", pathname: "/%23", mustReject: false, transportable: true },

  // Resource bounds.
  {
    name: "oversized pathname",
    pathname: `/${"a".repeat(8192)}`,
    mustReject: true,
    transportable: true
  },
  {
    name: "too many segments",
    pathname: `/${Array.from({ length: 257 }, () => "a").join("/")}`,
    mustReject: true,
    transportable: true
  }
];

/** The immutable shared raw-pathname corpus. */
export const rawPathnameCorpus: readonly RawPathnameCase[] = Object.freeze(rawCases);

/** A raw request-target an adapter must reject before any routing occurs. */
export interface AdapterRejectionCase {
  readonly name: string;
  readonly target: string;
}

/**
 * Request-targets that a conforming adapter must reject with `400` at the transport boundary
 * (non-origin-form) rather than passing to the pipeline.
 */
export const adapterRejectionCorpus: readonly AdapterRejectionCase[] = Object.freeze([
  { name: "absolute-form target", target: "https://example.test/about" },
  { name: "protocol-relative target", target: "//about" }
]);

/**
 * Splits an HTTP origin-form request-target into the raw pathname an adapter must pass to the
 * pipeline: everything before the first `?` or `#`, with no decoding or normalization.
 */
export function splitRequestTarget(target: string): string {
  const fragment = target.search(/[?#]/);
  return fragment === -1 ? target : target.slice(0, fragment);
}
