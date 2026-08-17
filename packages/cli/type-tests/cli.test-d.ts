import type { PreviewServer, ViteDevServer } from "vite";
import {
  type CliContext,
  type CliDiagnosticCode,
  type CliResult,
  type CliRuntime,
  runCli
} from "../src/index.js";

const context: CliContext = {
  cwd: "/application",
  writeError: () => undefined,
  writeOutput: () => undefined
};
const result: Promise<CliResult> = runCli(["build"], context);
declare const runtime: CliRuntime;
const injected: Promise<CliResult> = runCli(["dev"], context, runtime);
declare const server: NonNullable<CliResult["server"]>;
server satisfies ViteDevServer | PreviewServer;
const code: CliDiagnosticCode = "NUSA-CLI-0001";
void result;
void injected;
void code;

// @ts-expect-error output callbacks must accept diagnostic text
runCli([], { cwd: "/application", writeError: 1, writeOutput: () => undefined });
// @ts-expect-error unsupported diagnostic codes are rejected
const unsupported: CliDiagnosticCode = "NUSA-CLI-9999";
void unsupported;
