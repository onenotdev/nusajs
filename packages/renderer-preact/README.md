# `@nusajs/renderer-preact`

Official minimal buffered SSR renderer selected by ADR-002. It implements the universal
`@nusajs/core` renderer contract and ships no framework client JavaScript.

```ts
import { createPreactRenderer } from "@nusajs/renderer-preact";
import { createElement } from "preact";

const renderer = createPreactRenderer();
const page = createElement("main", null, "Hello from NusaJS");
```

Text and ordinary attributes are escaped by Preact. `dangerouslySetInnerHTML` is an explicit unsafe
escape hatch: it accepts trusted HTML and does not sanitize arbitrary input. Serialization,
hydration, streaming, and client islands are intentionally outside this minimal renderer.