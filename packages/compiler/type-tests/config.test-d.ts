import {
  CONFIG_DOCS_SLUG,
  CONFIG_ERROR_CODE,
  parseConfig,
  type ConfigDiagnostic,
  type ConfigResult,
  type FrameworkConfig
} from "../src/index.js";

const result: ConfigResult = parseConfig("", "nusa.config.ts");
result.valid satisfies boolean;
const config: Readonly<FrameworkConfig> = result.config;
config.securityMode satisfies "strict";
config.output satisfies "server" | "static";
const first: Readonly<ConfigDiagnostic> | undefined = result.diagnostics[0];
CONFIG_ERROR_CODE satisfies "NUSA-CONFIG-0001";
CONFIG_DOCS_SLUG satisfies string;

void config;
void first;
