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