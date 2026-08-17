# `@nusajs/core`

Universal foundational package for NusaJS. It is private during early development and currently
exports only package identity metadata. Runtime-specific APIs and dependencies do not belong here.

```ts
import { CORE_PACKAGE_NAME, CORE_VERSION } from "@nusajs/core";

console.log(`${CORE_PACKAGE_NAME}@${CORE_VERSION}`);
```

Only the package root is public. Source paths, `internal/*`, and undeclared subpaths are private.