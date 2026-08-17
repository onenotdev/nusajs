import {
  type ActiveDiagnosticCode,
  type BufferedRenderResult,
  CORE_PACKAGE_NAME,
  CORE_VERSION,
  type CorePackageName,
  type CoreVersion,
  type CreateRequestContextInput,
  type CreateRequestHandlerOptions,
  createDiagnostic,
  createRequestContext,
  createRequestHandler,
  createRouteMatcher,
  createSecurityHeaders,
  type CspDirectives,
  type Diagnostic,
  type DiagnosticCode,
  type DiagnosticSeverity,
  defineRenderer,
  mergeSecurityHeaders,
  mergeSecurityHeadersStrict,
  formatDevelopmentDiagnostic,
  formatProductionDiagnostic,
  type HandleRequestInput,
  type MatchRoute,
  type ProductionDiagnostic,
  type Renderer,
  type RenderInput,
  type RenderResult,
  type RequestContext,
  type RequestHandler,
  type RouteMatch,
  type RouteMatcher,
  type SecurityHeaderConflict,
  type SecurityHeaderMergeResult,
  type SecurityHeaderOptions,
  type SourcePosition,
  type SourceRange,
  type StreamingRenderResult,
  serializeDevelopmentDiagnostic
} from "@nusajs/core";

const packageName: CorePackageName = CORE_PACKAGE_NAME;
const version: CoreVersion = CORE_VERSION;

packageName satisfies "@nusajs/core";
version satisfies "0.0.0";

// @ts-expect-error package identity is an exact literal type
const invalidPackageName: CorePackageName = "nusajs";

void invalidPackageName;

const position: SourcePosition = { line: 1, column: 1 };
const range: SourceRange = { start: position, end: position };
const severity: DiagnosticSeverity = "warning";
const allocatedCode: DiagnosticCode = "NUSA-ROUTE-0002";
const activeCode: ActiveDiagnosticCode = "NUSA-ROUTE-0001";
const diagnostic: Readonly<Diagnostic> = createDiagnostic(
  { code: activeCode, severity, message: "Route conflict.", file: "src/route.ts", range },
  "https://docs.nusajs.example"
);
const text: string = formatDevelopmentDiagnostic(diagnostic);
const json: string = serializeDevelopmentDiagnostic(diagnostic);
const production: Readonly<ProductionDiagnostic> = formatProductionDiagnostic(
  allocatedCode,
  "request_1234"
);

// @ts-expect-error retired tombstones cannot construct diagnostics
createDiagnostic({ code: "NUSA-ROUTE-0002", message: "Retired." }, "https://docs.nusajs.example");

// @ts-expect-error third-party strings are not core diagnostic codes
const invalidCode: DiagnosticCode = "PLUGIN-ROUTE-0001";

void text;
void json;
void production;
void invalidCode;

const contextInput: CreateRequestContextInput<{ binding: string }> = {
  request: new Request("https://example.test/"),
  env: { binding: "value" },
  requestId: "request_1234"
};
const context: Readonly<RequestContext<{ binding: string }>> = createRequestContext(contextInput);
context.env.binding satisfies string;

// @ts-expect-error params values are strings
createRequestContext({ ...contextInput, params: { id: 123 } });

const renderer: Renderer<string, { binding: string }> = defineRenderer({
  id: "example",
  deliveries: new Set(["buffered"]),
  render: async (input: RenderInput<string, { binding: string }>): Promise<RenderResult> => ({
    delivery: "buffered",
    body: input.value,
    status: 200,
    headers: new Headers(),
    close: () => undefined
  })
});
renderer satisfies Renderer<string, { binding: string }>;

const result: RenderResult = await renderer.render({
  value: "html",
  context,
  signal: context.signal
});
if (result.delivery === "buffered") {
  result satisfies BufferedRenderResult;
}
declare const streaming: StreamingRenderResult;
streaming.body satisfies ReadableStream<Uint8Array>;

const matchRoutes = [
  {
    kind: "page",
    pattern: "/users/[id]",
    segments: [
      { kind: "static", value: "users" },
      { kind: "dynamic", value: "id" }
    ],
    specificity: [4, 3],
    file: "users/[id].page.ts"
  }
] as const satisfies readonly MatchRoute[];
const routeMatcher: Readonly<RouteMatcher<(typeof matchRoutes)[number]>> =
  createRouteMatcher(matchRoutes);
const routeMatch: Readonly<RouteMatch<(typeof matchRoutes)[number]>> | undefined =
  routeMatcher.match("/users/123", "page");
// biome-ignore lint/complexity/useLiteralKeys: strict index signatures prohibit property access.
routeMatch?.params["id"] satisfies string | undefined;

// @ts-expect-error route role must be explicit and valid
routeMatcher.match("/users/123", "handler");

const pipelineRoutes = [
  { ...matchRoutes[0], kind: "page" },
  {
    kind: "endpoint",
    pattern: "/api",
    segments: [{ kind: "static", value: "api" }],
    specificity: [4],
    file: "api.endpoint.ts"
  }
] as const satisfies readonly MatchRoute[];
const pipelineMatcher = createRouteMatcher<(typeof pipelineRoutes)[number]>(pipelineRoutes);
const pipelineOptions: CreateRequestHandlerOptions<
  (typeof pipelineRoutes)[number],
  string,
  { binding: string }
> = {
  matcher: pipelineMatcher,
  renderer,
  bindings: [
    { route: pipelineRoutes[0], load: (pageContext) => pageContext.env.binding },
    { route: pipelineRoutes[1], handle: async () => new Response("api") }
  ]
};
const pipeline: Readonly<
  RequestHandler<(typeof pipelineRoutes)[number], string, { binding: string }>
> = createRequestHandler(pipelineOptions);
const handleInput: HandleRequestInput<{ binding: string }> = {
  request: new Request("https://example.test/users/123"),
  pathname: "/users/123",
  env: { binding: "value" },
  requestId: "request_1234"
};
const pipelineResponse: Response = await pipeline.handle(handleInput);
void pipelineResponse;

createRequestHandler({
  ...pipelineOptions,
  bindings: [
    {
      route: pipelineRoutes[1],
      // @ts-expect-error endpoint handlers must return Response
      handle: () => "bad"
    }
  ]
});

const csp: CspDirectives = {
  "default-src": ["'self'"],
  "upgrade-insecure-requests": true
};
const securityOptions: SecurityHeaderOptions = {
  csp,
  hsts: { maxAge: 31_536_000, includeSubDomains: true },
  referrerPolicy: "no-referrer",
  permissionsPolicy: { geolocation: [] }
};
const securityHeaders: Headers = createSecurityHeaders(securityOptions);
const mergeResult: SecurityHeaderMergeResult = mergeSecurityHeaders(securityHeaders, new Headers());
mergeResult.conflicts satisfies readonly Readonly<SecurityHeaderConflict>[];
const strictHeaders: Headers = mergeSecurityHeadersStrict(securityHeaders, new Headers());
void strictHeaders;

// @ts-expect-error unknown CSP directives fail closed
createSecurityHeaders({ csp: { "not-a-directive": ["x"] } });

// @ts-expect-error referrer policy is a closed set
createSecurityHeaders({ referrerPolicy: "everything" });

// @ts-expect-error hsts maxAge must be a number
createSecurityHeaders({ hsts: { maxAge: "year" } });
