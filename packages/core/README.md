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