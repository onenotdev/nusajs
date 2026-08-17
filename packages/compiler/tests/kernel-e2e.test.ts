import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeServer, type NodeServer } from "@nusajs/adapter-node";
import { createRequestHandler, createRouteMatcher, type RequestContext } from "@nusajs/core";
import { createPreactRenderer } from "@nusajs/renderer-preact";
import { afterEach, describe, expect, it } from "vitest";
import {
  createRouteManifest,
  generateRouteTypes,
  type ManifestRoute,
  parseRouteGraph,
  scanRouteFiles
} from "../src/index.js";

const roots: string[] = [];
const servers: NodeServer[] = [];

function isEndpointRoute(
  route: Readonly<ManifestRoute>
): route is Readonly<ManifestRoute> & { readonly kind: "endpoint" } {
  return route.kind === "endpoint";
}

function isPageRoute(
  route: Readonly<ManifestRoute>
): route is Readonly<ManifestRoute> & { readonly kind: "page" } {
  return route.kind === "page";
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.shutdown()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "nusajs-kernel-"));
  roots.push(root);
  const routes = join(root, "src/routes");
  await mkdir(join(routes, "blog"), { recursive: true });
  await mkdir(join(routes, "health"), { recursive: true });
  const hostile = 'throw new Error("route modules must not execute");\n';
  await writeFile(join(routes, "index.page.ts"), hostile);
  await writeFile(join(routes, "blog/[slug].page.ts"), hostile);
  await writeFile(join(routes, "health/index.page.ts"), hostile);
  await writeFile(join(routes, "health/index.endpoint.ts"), hostile);
  return routes;
}

function rawRequest(
  port: number,
  path: string,
  method = "GET",
  host = "127.0.0.1"
): Promise<{ readonly body: string; readonly status: number | undefined }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: "127.0.0.1", port, path, method, headers: { host } },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.on("end", () => resolve({ body, status: response.statusCode }));
      }
    );
    request.on("error", reject);
    request.end();
  });
}

describe("kernel end-to-end fixture", () => {
  it("connects compiler output, typed hrefs, runtime dispatch, rendering, and Node transport", async () => {
    const routeRoot = await fixture();
    const records = await scanRouteFiles({ root: routeRoot });
    const graph = parseRouteGraph(records);
    const manifest = createRouteManifest(graph);
    const generated = generateRouteTypes(manifest);

    expect(manifest.routes.map((route) => route.pattern)).toEqual([
      "/blog/[slug]",
      "/health",
      "/health",
      "/"
    ]);
    const blog = manifest.routes.find((route) => route.pattern === "/blog/[slug]");
    expect(blog).toBeDefined();
    expect(generated.code).toContain(`${JSON.stringify(blog?.id)}: [`);
    expect(generated.code).toContain("encodeURIComponent(value)");

    const bindings = manifest.routes.map((route) => {
      if (isEndpointRoute(route)) {
        return {
          route,
          handle: () =>
            new Response('{"ok":true}', { headers: { "content-type": "application/json" } })
        };
      }
      if (!isPageRoute(route)) {
        throw new TypeError("unexpected route kind");
      }
      return {
        route,
        load: (context: Readonly<RequestContext<unknown>>) =>
          route.pattern === "/blog/[slug]"
            ? // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires index-signature access.
              `Post: ${context.params["slug"]}`
            : route.pattern === "/health"
              ? "page health"
              : "home"
      };
    });
    const matcher = createRouteMatcher(manifest.routes);
    const handler = createRequestHandler({
      matcher,
      bindings,
      renderer: createPreactRenderer()
    });
    const server = createNodeServer({ handler, createRequestId: () => "kernel-fixture" });
    servers.push(server);
    const { port } = await server.listen({ hostname: "127.0.0.1", port: 0 });

    const dynamic = await rawRequest(port, "/blog/hello%20world");
    expect(dynamic).toEqual({ body: "Post: hello world", status: 200 });
    const endpoint = await rawRequest(port, "/health");
    expect(endpoint).toEqual({ body: '{"ok":true}', status: 200 });
    const head = await rawRequest(port, "/", "HEAD");
    expect(head).toEqual({ body: "", status: 200 });
    expect(await rawRequest(port, "/missing")).toMatchObject({ status: 404 });
    expect(await rawRequest(port, "/blog/a%2Fb")).toMatchObject({ status: 404 });
    expect(await rawRequest(port, "/", "GET", "bad host value")).toMatchObject({ status: 400 });
  });
});
