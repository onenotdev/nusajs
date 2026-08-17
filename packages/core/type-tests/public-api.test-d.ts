import {
  type ActiveDiagnosticCode,
  CORE_PACKAGE_NAME,
  CORE_VERSION,
  createDiagnostic,
  type Diagnostic,
  type DiagnosticCode,
  type DiagnosticSeverity,
  formatDevelopmentDiagnostic,
  formatProductionDiagnostic,
  type ProductionDiagnostic,
  serializeDevelopmentDiagnostic,
  type SourcePosition,
  type SourceRange,
  type CorePackageName,
  type CoreVersion,
  createRequestContext,
  type CreateRequestContextInput,
  type RequestContext
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
