import {
  assertManifestSupported,
  createCapabilityManifest,
  createRouteManifest,
  createSecurityManifest,
  ROUTE_MANIFEST_NAME,
  type CapabilityManifest,
  type RouteManifest,
  type SecurityManifest
} from "../src/index.js";
import type { RouteGraph } from "../src/index.js";

declare const graph: RouteGraph;
const routeManifest: Readonly<RouteManifest> = createRouteManifest(graph);
routeManifest.schema satisfies typeof ROUTE_MANIFEST_NAME;
const securityManifest: Readonly<SecurityManifest> = createSecurityManifest();
securityManifest.mode satisfies "strict";
const capabilityManifest: Readonly<CapabilityManifest> = createCapabilityManifest();
void capabilityManifest;
assertManifestSupported(routeManifest, ROUTE_MANIFEST_NAME, 1);

// @ts-expect-error security mode is a strict literal, not an arbitrary string
const invalidMode: "compatible" = createSecurityManifest().mode;
void invalidMode;
