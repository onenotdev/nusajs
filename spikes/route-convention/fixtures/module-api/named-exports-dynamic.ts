// FW-004 module API candidate: named exports with a computed initialiser.
//
// This is the case docs/06_COMPILER_AND_DEV_SERVER.md requires to produce a visible
// diagnostic instead of being silently resolved by executing the module.

import { readRuntimeFromEnvironment } from "./unanalyzable-helper.ts";

export const route = {
  runtime: readRuntimeFromEnvironment(),
  rendering: "streaming"
};

export default function Page() {
  return null;
}
