import {
  createRouteManifest,
  type GeneratedRouteTypes,
  generateRouteTypes,
  type RouteGraph
} from "../src/index.js";

const graph: RouteGraph = { routes: [], boundaries: [] };
const generated: Readonly<GeneratedRouteTypes> = generateRouteTypes(createRouteManifest(graph));
const code: string = generated.code;
const ids: readonly string[] = generated.routeIds;
void code;
void ids;

// @ts-expect-error a route graph, not arbitrary input, is required
createRouteManifest({ routes: "unsafe", boundaries: [] });
// @ts-expect-error the generator consumes a versioned route manifest
void generateRouteTypes(graph);
