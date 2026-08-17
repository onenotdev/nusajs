import { lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { createNusaVitePlugin } from "@nusajs/compiler";
import {
  createServer as createViteServer,
  type PreviewServer,
  type ViteDevServer,
  build as viteBuild,
  preview as vitePreview
} from "vite";

const DOCS = "https://nusajs.dev/errors/cli";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

/** Stable CLI diagnostic codes. */
export type CliDiagnosticCode = "NUSA-CLI-0001" | "NUSA-CLI-0002" | "NUSA-CLI-0003";

/** Injectable output and working-directory boundary for the CLI. */
export interface CliContext {
  readonly cwd: string;
  readonly writeError: (message: string) => void;
  readonly writeOutput: (message: string) => void;
}

/** Running server returned by `dev` or `preview` for explicit lifecycle control. */
export type CliServer = ViteDevServer | PreviewServer;

/** Result of one CLI invocation. */
export interface CliResult {
  readonly exitCode: 0 | 1;
  readonly server?: CliServer;
}

/** Injectable Vite boundary used by tests and embedders. */
export interface CliRuntime {
  readonly build: typeof viteBuild;
  readonly createServer: typeof createViteServer;
  readonly preview: typeof vitePreview;
}

const defaultRuntime: CliRuntime = {
  build: viteBuild,
  createServer: createViteServer,
  preview: vitePreview
};

type Command =
  | { readonly kind: "help" }
  | {
      readonly kind: "dev";
      readonly root: string;
      readonly host: string;
      readonly port?: number;
    }
  | {
      readonly kind: "build";
      readonly root: string;
      readonly outDir: string;
      readonly sourcemap: boolean;
    }
  | {
      readonly kind: "preview";
      readonly root: string;
      readonly host: string;
      readonly port?: number;
    };

const HELP = `NusaJS CLI (experimental)\n\nUsage:\n  nusajs dev [--root <path>] [--host <host>] [--port <port>]\n  nusajs build [--root <path>] [--out-dir <path>] [--sourcemap]\n  nusajs preview [--root <path>] [--host <host>] [--port <port>]\n  nusajs --help`;

function diagnostic(code: CliDiagnosticCode, message: string, remediation: string): string {
  return `${code}: ${message}\nRemediation: ${remediation}\nDocs: ${DOCS}`;
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const port = Number(value);
  return Number.isSafeInteger(port) && port >= 1 && port <= 65_535 ? port : undefined;
}

function takeValue(args: readonly string[], index: number): string | undefined {
  const value = args[index + 1];
  return value !== undefined && !value.startsWith("--") ? value : undefined;
}

function parseOptions(args: readonly string[], cwd: string): Command | undefined {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") return { kind: "help" };
  const kind = args[0];
  if (kind !== "dev" && kind !== "build" && kind !== "preview") return undefined;

  let root = cwd;
  let host = "127.0.0.1";
  let port: number | undefined;
  let outDir = "dist";
  let sourcemap = false;

  for (let index = 1; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--sourcemap" && kind === "build") {
      sourcemap = true;
      continue;
    }
    if (
      option === "--root" ||
      option === "--host" ||
      option === "--port" ||
      option === "--out-dir"
    ) {
      const value = takeValue(args, index);
      if (value === undefined) return undefined;
      if (option === "--root") root = value;
      else if (option === "--host" && kind !== "build") host = value;
      else if (option === "--port" && kind !== "build") {
        port = parsePort(value);
        if (port === undefined) return undefined;
      } else if (option === "--out-dir" && kind === "build") outDir = value;
      else return undefined;
      index += 1;
      continue;
    }
    return undefined;
  }

  const absoluteRoot = resolve(cwd, root);
  if (kind === "build") return { kind, root: absoluteRoot, outDir, sourcemap };
  return { kind, root: absoluteRoot, host, ...(port === undefined ? {} : { port }) };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const metadata = await lstat(path);
    return metadata.isDirectory() && !metadata.isSymbolicLink();
  } catch {
    return false;
  }
}

function warnIfExposed(
  command: Extract<Command, { readonly host: string }>,
  context: CliContext
): void {
  if (!LOOPBACK_HOSTS.has(command.host)) {
    context.writeError(
      diagnostic(
        "NUSA-CLI-0002",
        "The local server was explicitly bound to a non-loopback host.",
        "Use the default loopback host unless trusted network access is required."
      )
    );
  }
}

/**
 * Runs one CLI command without terminating the process.
 *
 * The caller owns any returned server and must invoke `close()` during shutdown.
 */
export async function runCli(
  args: readonly string[],
  context: CliContext,
  runtime: CliRuntime = defaultRuntime
): Promise<CliResult> {
  const command = parseOptions(args, context.cwd);
  if (command === undefined) {
    context.writeError(
      diagnostic("NUSA-CLI-0001", "The command arguments are invalid.", "Run `nusajs --help`.")
    );
    return { exitCode: 1 };
  }
  if (command.kind === "help") {
    context.writeOutput(HELP);
    return { exitCode: 0 };
  }
  if (!(await isDirectory(command.root))) {
    context.writeError(
      diagnostic(
        "NUSA-CLI-0001",
        "The project root is not an existing directory.",
        "Pass an existing directory with `--root`."
      )
    );
    return { exitCode: 1 };
  }

  try {
    if (command.kind === "build") {
      await runtime.build({
        root: command.root,
        plugins: [createNusaVitePlugin({ root: command.root })],
        build: { outDir: command.outDir, sourcemap: command.sourcemap }
      });
      context.writeOutput("Build completed.");
      return { exitCode: 0 };
    }

    warnIfExposed(command, context);
    if (command.kind === "dev") {
      const server = await runtime.createServer({
        root: command.root,
        plugins: [createNusaVitePlugin({ root: command.root })],
        server: {
          host: command.host,
          strictPort: true,
          ...(command.port === undefined ? {} : { port: command.port })
        }
      });
      await server.listen();
      return { exitCode: 0, server };
    }

    const server = await runtime.preview({
      root: command.root,
      preview: {
        host: command.host,
        strictPort: true,
        ...(command.port === undefined ? {} : { port: command.port })
      }
    });
    return { exitCode: 0, server };
  } catch {
    context.writeError(
      diagnostic(
        "NUSA-CLI-0003",
        "The command failed without exposing internal error details.",
        "Review the project configuration and rerun the command."
      )
    );
    return { exitCode: 1 };
  }
}
