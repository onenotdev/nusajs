/** The severities supported by NusaJS diagnostics. */
export type DiagnosticSeverity = "error" | "warning" | "info";

/** A one-based location in a source file. */
export interface SourcePosition {
  readonly line: number;
  readonly column: number;
}

/** An ordered, inclusive source range. */
export interface SourceRange {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

const registry = {
  "NUSA-ADAPTER-0001": ["error", "/errors/nusa-adapter-0001", true],
  "NUSA-CONFIG-0001": ["error", "/errors/nusa-config-0001", true],
  "NUSA-INTERNAL-0001": ["error", "/errors/nusa-internal-0001", true],
  "NUSA-ROUTE-0001": ["error", "/errors/nusa-route-0001", true],
  "NUSA-ROUTE-0002": ["warning", "/errors/nusa-route-0002", false],
  "NUSA-SECURITY-0001": ["error", "/errors/nusa-security-0001", true],
  "NUSA-SERVER-0001": ["error", "/errors/nusa-server-0001", true]
} as const;

/** Every allocated core diagnostic code, including permanent retired tombstones. */
export type DiagnosticCode = keyof typeof registry;

/** A core diagnostic code that may be emitted by current framework code. */
export type ActiveDiagnosticCode = {
  [Code in DiagnosticCode]: (typeof registry)[Code][2] extends true ? Code : never;
}[DiagnosticCode];

/** Input used to create a validated diagnostic. */
export interface DiagnosticInput {
  readonly code: ActiveDiagnosticCode;
  readonly severity?: DiagnosticSeverity;
  readonly message: string;
  readonly file?: string;
  readonly range?: SourceRange;
  readonly hint?: string;
}

/** A validated diagnostic shared by development sinks. */
export interface Diagnostic {
  readonly code: ActiveDiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly file?: string;
  readonly range?: SourceRange;
  readonly hint?: string;
  readonly docs: string;
}

/** The only fields permitted at a production error boundary. */
export interface ProductionDiagnostic {
  readonly code: "NUSA-SERVER-0001";
  readonly requestId: string;
}

function fail(reason: string): never {
  throw new TypeError(`[NUSA-INTERNAL-0001] Invalid diagnostic: ${reason}`);
}

function validateText(value: string, field: string): void {
  const hasUnsafeControl = [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint === 127 ||
      (codePoint < 32 && codePoint !== 9 && codePoint !== 10 && codePoint !== 13)
    );
  });
  if (value.trim().length === 0 || hasUnsafeControl) {
    fail(`${field} must be non-empty text without control characters`);
  }
}

function validatePosition(position: SourcePosition, field: string): void {
  if (!Number.isSafeInteger(position.line) || position.line < 1)
    fail(`${field}.line must be positive`);
  if (!Number.isSafeInteger(position.column) || position.column < 1) {
    fail(`${field}.column must be positive`);
  }
}

function validateRange(range: SourceRange): void {
  validatePosition(range.start, "range.start");
  validatePosition(range.end, "range.end");
  if (
    range.end.line < range.start.line ||
    (range.end.line === range.start.line && range.end.column < range.start.column)
  ) {
    fail("range.end must not precede range.start");
  }
}

function validateFile(file: string): void {
  validateText(file, "file");
  if (/^(?:[a-zA-Z]:|[\\/])/.test(file) || file.includes("\\") || file.split("/").includes("..")) {
    fail("file must be a normalized workspace-relative path");
  }
}

function documentationUrl(origin: string, slug: string): string {
  let url: URL;
  try {
    url = new URL(slug, origin);
  } catch {
    return fail("documentationOrigin must be a valid URL");
  }
  const parsedOrigin = new URL(origin);
  if (
    parsedOrigin.protocol !== "https:" ||
    parsedOrigin.username !== "" ||
    parsedOrigin.password !== "" ||
    parsedOrigin.search !== "" ||
    parsedOrigin.hash !== "" ||
    url.origin !== parsedOrigin.origin
  ) {
    fail("documentationOrigin must be a credential-free HTTPS origin");
  }
  return url.href;
}

/**
 * Creates and freezes a validated development diagnostic.
 *
 * @param input - Static identity and development-only diagnostic details.
 * @param documentationOrigin - Credential-free HTTPS origin for error documentation.
 */
export function createDiagnostic(
  input: DiagnosticInput,
  documentationOrigin: string
): Readonly<Diagnostic> {
  const entry = registry[input.code];
  validateText(input.message, "message");
  if (input.hint !== undefined) validateText(input.hint, "hint");
  if (input.file !== undefined) validateFile(input.file);
  if (input.range !== undefined) validateRange(input.range);
  if (input.range !== undefined && input.file === undefined) fail("range requires file");
  const severity = input.severity ?? entry[0];
  if (input.code.startsWith("NUSA-SECURITY-") && severity === "info") {
    fail("security diagnostics cannot have info severity");
  }
  const range =
    input.range === undefined
      ? undefined
      : Object.freeze({
          start: Object.freeze({ ...input.range.start }),
          end: Object.freeze({ ...input.range.end })
        });
  return Object.freeze({
    code: input.code,
    severity,
    message: input.message,
    ...(input.file === undefined ? {} : { file: input.file }),
    ...(range === undefined ? {} : { range }),
    ...(input.hint === undefined ? {} : { hint: input.hint }),
    docs: documentationUrl(documentationOrigin, entry[1])
  });
}

/** Formats a diagnostic as deterministic plain development text. */
export function formatDevelopmentDiagnostic(diagnostic: Diagnostic): string {
  const lines = [`[${diagnostic.code}] ${diagnostic.message}`, `Severity: ${diagnostic.severity}`];
  if (diagnostic.file !== undefined) {
    const suffix =
      diagnostic.range === undefined
        ? ""
        : `:${diagnostic.range.start.line}:${diagnostic.range.start.column}-${diagnostic.range.end.line}:${diagnostic.range.end.column}`;
    lines.push(`File: ${diagnostic.file}${suffix}`);
  }
  if (diagnostic.hint !== undefined) lines.push(`Fix: ${diagnostic.hint}`);
  lines.push(`Docs: ${diagnostic.docs}`);
  return lines.join("\n");
}

/** Serializes a diagnostic for development-only machine consumers. */
export function serializeDevelopmentDiagnostic(diagnostic: Diagnostic): string {
  return JSON.stringify(diagnostic);
}

/**
 * Creates a fail-closed production-safe diagnostic containing no development details.
 *
 * The initial allowlist intentionally contains only the generic server code.
 */
export function formatProductionDiagnostic(
  _code: DiagnosticCode | (string & {}),
  requestId: string
): Readonly<ProductionDiagnostic> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) {
    fail("requestId must be an 8-128 character URL-safe token");
  }
  return Object.freeze({
    code: "NUSA-SERVER-0001" as const,
    requestId
  });
}
