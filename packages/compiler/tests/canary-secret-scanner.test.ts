import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  containsCanary,
  prepareCanaries,
  scanCanarySecretArtifacts
} from "../src/canary-secret-scanner.js";

const roots: string[] = [];
const encoder = new TextEncoder();

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function outputFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "nusajs-canary-"));
  roots.push(root);
  return root;
}

describe("canary secret scanner", () => {
  it("finds exact bytes at zero, at the end, and when occurrences overlap", () => {
    const canary = encoder.encode("NUSA_CANARY_aaa");
    expect(containsCanary(encoder.encode("NUSA_CANARY_aaa"), [canary])).toBe(true);
    expect(containsCanary(encoder.encode("prefix-NUSA_CANARY_aaa"), [canary])).toBe(true);
    expect(containsCanary(encoder.encode("nusa_canary_aaa"), [canary])).toBe(false);
    expect(containsCanary(encoder.encode("NUSA%5FCANARY%5Faaa"), [canary])).toBe(false);
  });

  it("validates and defensively copies canaries", () => {
    const source = encoder.encode("NUSA_CANARY_copy");
    const prepared = prepareCanaries({ canaries: [source] });
    source.fill(0);
    expect(containsCanary(encoder.encode("NUSA_CANARY_copy"), prepared)).toBe(true);
    expect(() => prepareCanaries({ canaries: [] })).toThrow("NUSA-SECURITY-0002");
    expect(() => prepareCanaries({ canaries: [new Uint8Array()] })).toThrow(
      "non-empty byte sequence"
    );
    expect(() =>
      prepareCanaries({ canaries: [encoder.encode("duplicate"), encoder.encode("duplicate")] })
    ).toThrow("Duplicate canaries");
    expect(() => prepareCanaries({ canaries: [new Uint8Array([0])] })).toThrow("printable ASCII");
  });

  it("scans clean nested binary artifacts deterministically", async () => {
    const root = await outputFixture();
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "assets", "app.bin"), new Uint8Array([0, 1, 2, 3]));
    await expect(
      scanCanarySecretArtifacts(
        root,
        prepareCanaries({ canaries: [encoder.encode("NUSA_CANARY_clean")] })
      )
    ).resolves.toBeUndefined();
  });

  it("fails with a redacted static diagnostic for matching artifacts", async () => {
    const root = await outputFixture();
    const canaryText = "NUSA_CANARY_never_print_me";
    await writeFile(
      join(root, "private-name.map"),
      `{"sourcesContent":[${JSON.stringify(canaryText)}]}`
    );
    let message = "";
    try {
      await scanCanarySecretArtifacts(
        root,
        prepareCanaries({ canaries: [encoder.encode(canaryText)] })
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("NUSA-SECURITY-0002");
    expect(message).toContain("source map artifact 1");
    expect(message).not.toContain(canaryText);
    expect(message).not.toContain("private-name.map");
    expect(message).not.toContain(root);
  });

  it("rejects missing output roots and linked entries without exposing paths", async () => {
    const root = await outputFixture();
    const outside = await outputFixture();
    const canaries = prepareCanaries({ canaries: [encoder.encode("NUSA_CANARY_link")] });
    await expect(scanCanarySecretArtifacts(join(root, "missing"), canaries)).rejects.toThrow(
      "output directory could not be inspected safely"
    );
    await writeFile(join(outside, "artifact.js"), "clean");
    try {
      await symlink(join(outside, "artifact.js"), join(root, "artifact.js"), "file");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") return;
      throw error;
    }
    let message = "";
    try {
      await scanCanarySecretArtifacts(root, canaries);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("entry could not be inspected safely");
    expect(message).not.toContain(root);
    expect(message).not.toContain(outside);
  });
});
