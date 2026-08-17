import type { Renderer } from "@nusajs/core";
import { type ComponentChild, createElement } from "preact";
import { createPreactRenderer, PREACT_RENDERER_ID } from "@nusajs/renderer-preact";

PREACT_RENDERER_ID satisfies "preact";
const renderer: Renderer<ComponentChild, { region: string }> = createPreactRenderer<{
  region: string;
}>();
void renderer;

// @ts-expect-error renderer values must be valid Preact children
await createPreactRenderer().render({ value: { invalid: true } });

createElement("p", null, "typed");
