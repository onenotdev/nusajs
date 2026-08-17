import type { Plugin } from "vite";
import {
  createNusaVitePlugin,
  type NusaVitePluginOptions,
  type NusaVitePluginState,
  ROUTE_MANIFEST_VIRTUAL_ID,
  TYPED_ROUTES_VIRTUAL_ID
} from "../src/index.js";

const options: NusaVitePluginOptions = { root: "/application", configFile: false };
const plugin: Plugin = createNusaVitePlugin(options);
ROUTE_MANIFEST_VIRTUAL_ID satisfies "virtual:nusajs/route-manifest";
TYPED_ROUTES_VIRTUAL_ID satisfies "virtual:nusajs/typed-routes";
declare const state: NusaVitePluginState;
state.config.output satisfies "server" | "static";
state.routeManifest.routes satisfies readonly unknown[];
void plugin;

// @ts-expect-error relative route roots are represented as strings but invalid option keys are not accepted
createNusaVitePlugin({ routeRoot: "routes" });
// @ts-expect-error configFile must be a path or false
createNusaVitePlugin({ configFile: true });
