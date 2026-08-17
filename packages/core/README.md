# `@nusajs/core`

Universal foundational package for NusaJS. It is private during early development and exports
package identity metadata plus the runtime-independent diagnostic contract. Runtime-specific APIs
and dependencies do not belong here.

```ts
import { CORE_PACKAGE_NAME, CORE_VERSION } from "@nusajs/core";

console.log(`${CORE_PACKAGE_NAME}@${CORE_VERSION}`);
```

```ts
import {
	createDiagnostic,
	formatDevelopmentDiagnostic,
	formatProductionDiagnostic
} from "@nusajs/core";

const diagnostic = createDiagnostic(
	{
		code: "NUSA-CONFIG-0001",
		message: "Configuration value is invalid.",
		file: "nusa.config.ts",
		hint: "Use a supported value."
	},
	"https://docs.example.com"
);

console.error(formatDevelopmentDiagnostic(diagnostic));

// Production boundaries expose no development details.
const safe = formatProductionDiagnostic(diagnostic.code, "request_1234");
```

Only the package root is public. Source paths, `internal/*`, and undeclared subpaths are private.

```ts
import { createRequestContext } from "@nusajs/core";

const context = createRequestContext({
	request: new Request("https://example.com/"),
	env: { region: "local" },
	requestId: "request_1234"
});

context.locals.set(Symbol.for("example"), "request-local value");
```

Renderers remain behind a universal contract and receive request-local state explicitly:

```ts
import { defineRenderer } from "@nusajs/core";

const renderer = defineRenderer({
	id: "example",
	deliveries: new Set(["buffered"]),
	render: async ({ value, signal }) => {
		signal.throwIfAborted();
		return {
			delivery: "buffered",
			body: String(value),
			status: 200,
			headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
			close: () => undefined
		};
	}
});
```

Compiler-produced route records can be compiled once into a universal matcher. Pass the raw
pathname before URL canonicalization and select the page or endpoint role explicitly:

```ts
import { createRouteMatcher } from "@nusajs/core";

const matcher = createRouteMatcher([
	{
		kind: "page",
		pattern: "/blog/[slug]",
		segments: [
			{ kind: "static", value: "blog" },
			{ kind: "dynamic", value: "slug" }
		],
		specificity: [4, 3],
		file: "blog/[slug].page.ts"
	}
]);

const match = matcher.match("/blog/hello", "page");
console.log(match?.params.slug);
```

Malformed escapes, encoded separators, dot segments, duplicate or non-root trailing slashes,
controls, query/fragment syntax, and over-limit pathnames fail closed with no match. Parameters are
decoded as strict UTF-8, normalized to NFC, copied into a frozen null-prototype record, and remain
untrusted application input.

Compose those contracts into one endpoint-first universal request pipeline. Adapters must preserve
and pass the raw pathname separately; endpoint responses pass through unchanged, while page values
are converted through the selected renderer:

```ts
import { createRequestHandler, createRouteMatcher, defineRenderer } from "@nusajs/core";

const page = {
	kind: "page",
	pattern: "/",
	segments: [],
	specificity: [],
	file: "index.page.ts"
} as const;
const matcher = createRouteMatcher([page]);
const renderer = defineRenderer({
	id: "example",
	deliveries: new Set(["buffered"]),
	render: async ({ value }) => ({
		delivery: "buffered" as const,
		body: String(value),
		status: 200,
		headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
		close: () => undefined
	})
});
const pipeline = createRequestHandler({
	matcher,
	renderer,
	bindings: [{ route: page, load: () => "<h1>Hello</h1>" }]
});

const response = await pipeline.handle({
	request: new Request("https://example.test/"),
	pathname: "/",
	env: {},
	requestId: "request_1234"
});
```

Pages support `GET` and `HEAD`; endpoint roles are selected first for every method. Missing and
malformed paths return a plain-text 404. Handler and renderer exceptions propagate to the adapter,
which owns production-safe redaction. Streaming pages preserve backpressure and release renderer
resources on completion, cancellation, source failure, or request abort.

Security headers are explicit, deterministic, and merge-safe. Build an opt-in policy and merge a
child response into a stricter parent without silently weakening it:

```ts
import {
  createSecurityHeaders,
  mergeSecurityHeaders,
  mergeSecurityHeadersStrict
} from "@nusajs/core";

const platformPolicy = createSecurityHeaders({
  csp: { "default-src": ["'self'"], "frame-ancestors": ["'none'"] },
  hsts: { maxAge: 31_536_000, includeSubDomains: true },
  frameOptions: "DENY",
  contentTypeOptions: "nosniff"
});

const appHeaders = new Headers({
  "cache-control": "no-store",
  "content-security-policy": "script-src 'self'"
});

const merged = mergeSecurityHeadersStrict(platformPolicy, appHeaders);
// Conflicts (e.g. a child that widens a CSP directive) throw instead of weakening the parent.
```

Opaque tokens and identifiers use a fixed 256-bit entropy floor from Web Crypto, encoded as
unpadded base64url, and fail closed when Web Crypto is unavailable:

```ts
import { createSecureToken } from "@nusajs/core";

const nonce = createSecureToken(); // 43-character unpadded base64url, 256 bits
```

Random tokens provide unpredictability only, never integrity or confidentiality. The universal
package boundary scanner rejects `Math.random` in framework runtime code.