// FW-004 module API candidate: definePage() wrapper.
//
// Route configuration is an argument to a framework call whose result is the
// default export. Reading it statically requires resolving the callee to the
// framework helper and then reading the argument's object literal.

import { definePage } from "@nusajs/core";

export default definePage({
  runtime: "server",
  rendering: "streaming",
  revalidate: 60,
  params: {
    slug: "string"
  },
  async loader() {
    return { title: "Hello" };
  },
  component() {
    return null;
  }
});
