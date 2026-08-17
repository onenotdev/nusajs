import ts from "typescript";

/** Stable error code for configuration schema failures (FW-103, AC-COMP-03). */
export const CONFIG_ERROR_CODE = "NUSA-CONFIG-0001" as const;

/** Documentation slug attached to every configuration diagnostic. */
export const CONFIG_DOCS_SLUG = "/errors/nusa-config-0001" as const;

/** A fail-closed configuration diagnostic with an exact property path. */
export interface ConfigDiagnostic {
  readonly code: "NUSA-CONFIG-0001";
  /** Exact dotted property path, e.g. `security.mode` or `<config>`. */
  readonly path: string;
  /** The expected type or value set. */
  readonly expected: string;
  /** Secret-free description of the received value. */
  readonly received: string;
  /** Concrete remediation. */
  readonly remediation: string;
  readonly docs: string;
}

/** The statically validated framework configuration. */
export interface FrameworkConfig {
  readonly output: "server" | "static";
  readonly securityMode: "strict";
  /** Property paths whose values are dynamic and were not executed. */
  readonly dynamicValues: readonly string[];
}

/** The result of statically loading and validating configuration. */
export interface ConfigResult {
  readonly config: Readonly<FrameworkConfig>;
  readonly diagnostics: readonly Readonly<ConfigDiagnostic>[];
  /** True when no diagnostic was produced. */
  readonly valid: boolean;
}

const maximumDepth = 8;
const unsafeKeys = new Set(["__proto__", "constructor", "prototype"]);
const legalTopLevelKeys = new Set(["adapter", "output", "plugins", "renderer", "security"]);
const legalOutputs = new Set(["server", "static"]);

type Scalar = string | number | boolean | null;

function diagnostic(
  path: string,
  expected: string,
  received: string,
  remediation: string
): ConfigDiagnostic {
  return Object.freeze({
    code: CONFIG_ERROR_CODE,
    path,
    expected,
    received,
    remediation,
    docs: CONFIG_DOCS_SLUG
  });
}

function describeValue(value: unknown): string {
  if (value === undefined) return "a dynamic expression that was not executed";
  if (value === null) return "null";
  if (typeof value === "string") return "a string";
  if (typeof value === "number") return "a number";
  if (typeof value === "boolean") return "a boolean";
  if (Array.isArray(value)) {
    return `an array with ${value.length} ${value.length === 1 ? "element" : "elements"}`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `an object with ${keys.length} ${keys.length === 1 ? "key" : "keys"}`;
  }
  return "an unsupported value";
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isStringLiteral(name) || ts.isIdentifier(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

interface ExtractedValue {
  readonly scalar: Scalar | undefined;
  readonly object: Readonly<Record<string, unknown>> | undefined;
  readonly array: readonly unknown[] | undefined;
  readonly dynamic: boolean;
}

function extract(
  node: ts.Expression,
  path: string,
  depth: number,
  diagnostics: ConfigDiagnostic[],
  dynamicValues: string[]
): ExtractedValue {
  if (depth > maximumDepth) {
    diagnostics.push(
      diagnostic(
        path,
        "a nesting depth of at most 8",
        `a depth beyond ${maximumDepth}`,
        "flatten the configuration"
      )
    );
    return { scalar: undefined, object: undefined, array: undefined, dynamic: true };
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { scalar: node.text, object: undefined, array: undefined, dynamic: false };
  }
  if (ts.isNumericLiteral(node)) {
    return { scalar: Number(node.text), object: undefined, array: undefined, dynamic: false };
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { scalar: true, object: undefined, array: undefined, dynamic: false };
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { scalar: false, object: undefined, array: undefined, dynamic: false };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { scalar: null, object: undefined, array: undefined, dynamic: false };
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return {
      scalar: -Number(node.operand.text),
      object: undefined,
      array: undefined,
      dynamic: false
    };
  }
  if (ts.isObjectLiteralExpression(node)) {
    const object: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        dynamicValues.push(`${path}.<computed>`);
        continue;
      }
      const key = propertyNameText(property.name);
      if (key === undefined) {
        dynamicValues.push(`${path}.<computed>`);
        continue;
      }
      if (unsafeKeys.has(key)) {
        diagnostics.push(
          diagnostic(
            `${path}.${key}`,
            "a safe property name",
            `the reserved property name "${key}"`,
            "rename the property"
          )
        );
        continue;
      }
      const childPath = `${path}.${key}`;
      const child = extract(property.initializer, childPath, depth + 1, diagnostics, dynamicValues);
      if (child.dynamic) {
        dynamicValues.push(childPath);
        continue;
      }
      if (child.scalar !== undefined) {
        Object.defineProperty(object, key, { value: child.scalar, enumerable: true });
      } else if (child.object !== undefined) {
        Object.defineProperty(object, key, { value: child.object, enumerable: true });
      } else if (child.array !== undefined) {
        Object.defineProperty(object, key, { value: child.array, enumerable: true });
      }
    }
    return { scalar: undefined, object: Object.freeze(object), array: undefined, dynamic: false };
  }
  if (ts.isArrayLiteralExpression(node)) {
    const elements: unknown[] = [];
    node.elements.forEach((element, index) => {
      const childPath = `${path}[${index}]`;
      const child = extract(element, childPath, depth + 1, diagnostics, dynamicValues);
      if (child.dynamic) {
        dynamicValues.push(childPath);
      } else if (child.scalar !== undefined) {
        elements.push(child.scalar);
      } else if (child.object !== undefined) {
        elements.push(child.object);
      } else if (child.array !== undefined) {
        elements.push(child.array);
      }
    });
    return { scalar: undefined, object: undefined, array: Object.freeze(elements), dynamic: false };
  }
  return { scalar: undefined, object: undefined, array: undefined, dynamic: true };
}

interface SourceFileWithParseDiagnostics extends ts.SourceFile {
  // Runtime-only API: TypeScript exposes parse diagnostics on the source file.
  readonly parseDiagnostics: readonly ts.Diagnostic[];
}

function parseDiagnostics(sourceFile: ts.SourceFile): readonly ts.Diagnostic[] {
  const withDiagnostics = sourceFile as unknown as SourceFileWithParseDiagnostics;
  return withDiagnostics.parseDiagnostics;
}

function findConfigExpression(sourceFile: ts.SourceFile): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  function visit(node: ts.Node): void {
    if (found !== undefined) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineConfig" &&
      node.arguments.length === 1
    ) {
      found = node.arguments[0];
      return;
    }
    if (ts.isExportAssignment(node) && node.isExportEquals === false) {
      found = node.expression;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

function validate(
  object: Readonly<Record<string, unknown>>,
  path: string,
  diagnostics: ConfigDiagnostic[]
): { readonly output: "server" | "static"; readonly securityMode: "strict" } {
  let output: "server" | "static" = "server";
  for (const key of Object.keys(object)) {
    if (!legalTopLevelKeys.has(key)) {
      diagnostics.push(
        diagnostic(
          path,
          "one of adapter, output, plugins, renderer, security",
          describeValue(object[key]),
          "remove or rename the unknown property"
        )
      );
    }
  }
  // biome-ignore lint/complexity/useLiteralKeys: strict index-signature access requires brackets.
  const receivedOutput = object["output"];
  if (receivedOutput !== undefined) {
    if (typeof receivedOutput !== "string" || !legalOutputs.has(receivedOutput)) {
      diagnostics.push(
        diagnostic(
          `${path}.output`,
          'the string "server" or "static"',
          describeValue(receivedOutput),
          'use output: "server" or output: "static"'
        )
      );
    } else {
      output = receivedOutput as "server" | "static";
    }
  }
  // biome-ignore lint/complexity/useLiteralKeys: strict index-signature access requires brackets.
  const security = object["security"];
  if (security !== undefined) {
    if (security === null || typeof security !== "object" || Array.isArray(security)) {
      diagnostics.push(
        diagnostic(
          `${path}.security`,
          "an object",
          describeValue(security),
          'use security: { mode: "strict" }'
        )
      );
    } else {
      const securityObject = security as Readonly<Record<string, unknown>>;
      for (const key of Object.keys(securityObject)) {
        if (key !== "mode") {
          diagnostics.push(
            diagnostic(
              `${path}.security.${key}`,
              "only the mode property",
              "an unknown security property",
              "remove or rename the property"
            )
          );
        }
      }
      // biome-ignore lint/complexity/useLiteralKeys: strict index-signature access requires brackets.
      const mode = securityObject["mode"];
      if (mode !== undefined && mode !== "strict") {
        diagnostics.push(
          diagnostic(
            `${path}.security.mode`,
            'the string "strict"',
            describeValue(mode),
            'use security: { mode: "strict" } or omit the key (it defaults to strict)'
          )
        );
      }
    }
  }
  return { output, securityMode: "strict" };
}

/**
 * Statically loads and validates framework configuration without executing it.
 *
 * Only literal string, number, boolean, null, object, and array values are read from the source
 * through the TypeScript parser. Function calls such as `adapter: node()` are never executed and
 * are recorded as dynamic values, which the PRD requires to produce a visible diagnostic. Unknown
 * properties, invalid values, reserved property names, and excessive nesting fail closed with an
 * exact property path and a secret-free description of the received value.
 */
export function parseConfig(source: string, file: string): ConfigResult {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const diagnostics: ConfigDiagnostic[] = [];
  const syntaxDiagnostics = parseDiagnostics(sourceFile);
  if (syntaxDiagnostics.length > 0) {
    return Object.freeze({
      config: Object.freeze({
        output: "server" as const,
        securityMode: "strict" as const,
        dynamicValues: Object.freeze([])
      }),
      diagnostics: Object.freeze([
        diagnostic(
          "<config>",
          "a syntactically valid configuration file",
          `a file with ${syntaxDiagnostics.length} syntax ${syntaxDiagnostics.length === 1 ? "error" : "errors"}`,
          "fix the syntax errors"
        )
      ]),
      valid: false
    });
  }
  const expression = findConfigExpression(sourceFile);
  if (expression === undefined) {
    return Object.freeze({
      config: Object.freeze({
        output: "server" as const,
        securityMode: "strict" as const,
        dynamicValues: Object.freeze([])
      }),
      diagnostics: Object.freeze([
        diagnostic(
          "<config>",
          "a defineConfig() call or a default export object",
          "no configuration object found",
          "export default defineConfig({ ... }) from the configuration file"
        )
      ]),
      valid: false
    });
  }
  const dynamicValues: string[] = [];
  const extracted = extract(expression, "<config>", 0, diagnostics, dynamicValues);
  if (extracted.object === undefined) {
    return Object.freeze({
      config: Object.freeze({
        output: "server" as const,
        securityMode: "strict" as const,
        dynamicValues: Object.freeze([])
      }),
      diagnostics: Object.freeze([
        diagnostic(
          "<config>",
          "an object literal",
          describeValue(undefined),
          "export an object literal from defineConfig"
        )
      ]),
      valid: false
    });
  }
  const validated = validate(extracted.object, "<config>", diagnostics);
  return Object.freeze({
    config: Object.freeze({
      output: validated.output,
      securityMode: validated.securityMode,
      dynamicValues: Object.freeze([...dynamicValues])
    }),
    diagnostics: Object.freeze(diagnostics),
    valid: diagnostics.length === 0
  });
}
