import { defineRenderer, type Renderer } from "@nusajs/core";
import {
  type ComponentChild,
  type ComponentChildren,
  type ComponentType,
  createElement,
  Fragment
} from "preact";
import renderToString from "preact-render-to-string";

/** Stable identifier of the official Preact renderer. */
export const PREACT_RENDERER_ID = "preact";

/** Props exposed to a Preact layout component. */
export interface PreactLayoutProps {
  readonly children: ComponentChildren;
}

/** A children-only Preact layout component. */
export type PreactLayoutComponent = ComponentType<PreactLayoutProps>;

/**
 * Creates the official buffered Preact SSR renderer.
 *
 * Preact escapes normal text and attributes. Its `dangerouslySetInnerHTML` property is an explicit
 * unsafe escape hatch and does not sanitize arbitrary HTML.
 */
export function createPreactRenderer<Env = unknown>(): Renderer<
  ComponentChild,
  Env,
  PreactLayoutComponent
> {
  return defineRenderer({
    id: PREACT_RENDERER_ID,
    deliveries: new Set(["buffered"]),
    render: async ({ value, layouts, signal }) => {
      signal.throwIfAborted();
      let tree = value;
      for (let index = layouts.length - 1; index >= 0; index -= 1) {
        const Layout = layouts[index];
        if (Layout !== undefined) tree = createElement(Layout, null, tree);
      }
      const body = renderToString(createElement(Fragment, null, tree));
      signal.throwIfAborted();
      return {
        delivery: "buffered",
        body,
        status: 200,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        close: () => undefined
      };
    }
  });
}
