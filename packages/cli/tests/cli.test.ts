import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InlineConfig, PreviewServer, ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CliContext, type CliRuntime, runCli } from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "nusajs-cli-"));
  roots.push(root);
  return root;
}

function output(cwd: string): {
  readonly context: CliContext;
  readonly errors: string[];
  readonly messages: string[];
} {
  const errors: string[] = [];
  const messages: string[] = [];
  return {
    context: {
      cwd,
      writeError: (message) => errors.push(message),
      writeOutput: (message) => messages.push(message)
    },
    errors,
    messages
  };
}

function runtime(records: InlineConfig[], failBuild = false): CliRuntime {
  const devServer = {
    listen: vi.fn(async () => undefined)
  } as unknown as ViteDevServer;
  const previewServer = {} as PreviewServer;
  return {
    build: vi.fn(async (config: InlineConfig) => {
      records.push(config);
      if (failBuild) throw new Error("SECRET_7f94");
      return undefined as never;
    }) as CliRuntime["build"],
    createServer: vi.fn(async (config: InlineConfig) => {
      records.push(config);
      return devServer;
    }) as CliRuntime["createServer"],
    preview: vi.fn(async (config: InlineConfig) => {
      records.push(config);
      return previewServer;
    }) as CliRuntime["preview"]
  };
}

describe("runCli", () => {
  it("prints deterministic help and rejects invalid arguments without echoing them", async () => {
    const root = await fixture();
    const help = output(root);
    expect(await runCli(["--help"], help.context)).toEqual({ exitCode: 0 });
    expect(help.messages[0]).toContain("nusajs dev");

    const invalid = output(root);
    expect(await runCli(["unknown", "SECRET_7f94"], invalid.context)).toEqual({ exitCode: 1 });
    expect(invalid.errors[0]).toContain("NUSA-CLI-0001");
    expect(invalid.errors[0]).not.toContain("SECRET_7f94");
  });

  it("fails closed for a missing root before invoking Vite", async () => {
    const root = await fixture();
    const logs = output(root);
    const records: InlineConfig[] = [];
    expect(await runCli(["build", "--root", "missing"], logs.context, runtime(records))).toEqual({
      exitCode: 1
    });
    expect(records).toEqual([]);
    expect(logs.errors[0]).toContain("NUSA-CLI-0001");
  });

  it("rejects a linked project root before invoking Vite and redacts its path", async () => {
    const target = await fixture();
    const container = await fixture();
    const linkedRoot = join(container, "project-link");
    await symlink(target, linkedRoot, "junction");
    const logs = output(container);
    const records: InlineConfig[] = [];
    expect(await runCli(["build", "--root", linkedRoot], logs.context, runtime(records))).toEqual({
      exitCode: 1
    });
    expect(records).toEqual([]);
    expect(logs.errors[0]).toContain("NUSA-CLI-0001");
    expect(logs.errors[0]).not.toContain(linkedRoot);
    expect(logs.errors[0]).not.toContain(target);
  });

  it("builds with the Nusa plugin and source maps disabled unless explicitly enabled", async () => {
    const root = await fixture();
    const records: InlineConfig[] = [];
    const logs = output(root);
    expect(await runCli(["build"], logs.context, runtime(records))).toEqual({ exitCode: 0 });
    expect(records[0]?.root).toBe(root);
    expect(records[0]?.build?.sourcemap).toBe(false);
    expect(records[0]?.plugins).toHaveLength(1);

    await runCli(["build", "--sourcemap"], logs.context, runtime(records));
    expect(records[1]?.build?.sourcemap).toBe(true);
  });

  it("uses loopback by default and warns on explicit network exposure", async () => {
    const root = await fixture();
    const records: InlineConfig[] = [];
    const local = output(root);
    const dev = await runCli(["dev"], local.context, runtime(records));
    expect(dev.exitCode).toBe(0);
    expect(dev.server).toBeDefined();
    expect(records[0]?.server?.host).toBe("127.0.0.1");
    expect(local.errors).toEqual([]);

    const exposed = output(root);
    await runCli(["dev", "--host", "0.0.0.0"], exposed.context, runtime(records));
    expect(exposed.errors[0]).toContain("NUSA-CLI-0002");
  });

  it("previews existing build output through Vite without installing the compiler plugin", async () => {
    const root = await fixture();
    const records: InlineConfig[] = [];
    const logs = output(root);
    const result = await runCli(["preview", "--port", "4174"], logs.context, runtime(records));
    expect(result.exitCode).toBe(0);
    expect(result.server).toBeDefined();
    expect(records[0]?.preview).toMatchObject({ host: "127.0.0.1", port: 4174, strictPort: true });
    expect(records[0]?.plugins).toBeUndefined();
  });

  it("redacts Vite failures and returns a stable diagnostic", async () => {
    const root = await fixture();
    const logs = output(root);
    const failing = runtime([], true);
    expect(await runCli(["build"], logs.context, failing)).toEqual({ exitCode: 1 });
    expect(logs.errors[0]).toContain("NUSA-CLI-0003");
    expect(logs.errors[0]).not.toContain("SECRET_7f94");
  });
});
