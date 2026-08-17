import { defineRenderer, type Renderer } from "@nusajs/core";
import { type ComponentChild, createElement, Fragment } from "preact";
import renderToString from "preact-render-to-string";

/** Stable identifier of the official Preact renderer. */
export const PREACT_RENDERER_ID = "preact";

/**
 * Creates the official buffered Preact SSR renderer.
 *
 * Preact escapes normal text and attributes. Its `dangerouslySetInnerHTML` property is an explicit
 * unsafe escape hatch and does not sanitize arbitrary HTML.
 */
export function createPreactRenderer<Env = unknown>(): Renderer<ComponentChild, Env> {
  return defineRenderer({
    id: PREACT_RENDERER_ID,
    deliveries: new Set(["buffered"]),
    render: async ({ value, signal }) => {
      signal.throwIfAborted();
      const body = renderToString(createElement(Fragment, null, value));
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
