// FW-004 module API candidate: definePage() imported under an alias.
//
// Included because a call-based API only stays analyzable if the compiler resolves
// the callee identifier back to the framework import. Aliasing, re-export, and
// local shadowing all defeat a name-only match.

import { definePage as dp } from "@nusajs/core";

export default dp({
  runtime: "server",
  rendering: "streaming",
  params: {
    slug: "string"
  },
  component() {
    return null;
  }
});
