import type { Dirent, Stats } from "node:fs";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const MAX_CANARIES = 32;
const MAX_CANARY_BYTES = 256;
const MAX_FILES = 10_000;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const MAX_DEPTH = 64;
const ASCII_MIN = 0x21;
const ASCII_MAX = 0x7e;

/** Opt-in exact canaries scanned from final production artifacts. */
export interface CanarySecretScanOptions {
  /** Non-empty printable-ASCII canaries. Values are copied before build work starts. */
  readonly canaries: readonly Uint8Array[];
}

export const CANARY_SECRET_ERROR_CODE = "NUSA-SECURITY-0002";

function failure(message: string): never {
  throw new Error(
    `[${CANARY_SECRET_ERROR_CODE}] ${message}. Remediation: remove the secret-bearing value before producing artifacts. Docs: https://nusajs.dev/errors/nusa-security-0002`
  );
}

function contained(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((byte, index) => byte === right[index]);
}

export function prepareCanaries(options: Readonly<CanarySecretScanOptions>): readonly Uint8Array[] {
  if (options === null || typeof options !== "object" || Array.isArray(options))
    failure("Canary scanner options are invalid");
  if (!Array.isArray(options.canaries) || options.canaries.length === 0)
    failure("At least one canary is required");
  if (options.canaries.length > MAX_CANARIES) failure("The canary count limit was exceeded");

  const copies: Uint8Array[] = [];
  for (const canary of options.canaries) {
    if (!(canary instanceof Uint8Array) || canary.byteLength === 0)
      failure("Every canary must be a non-empty byte sequence");
    if (canary.byteLength > MAX_CANARY_BYTES) failure("The canary byte limit was exceeded");
    if (canary.some((byte) => byte < ASCII_MIN || byte > ASCII_MAX))
      failure("Every canary must contain printable ASCII bytes only");
    const copy = Uint8Array.from(canary);
    if (copies.some((existing) => equal(existing, copy))) failure("Duplicate canaries are invalid");
    copies.push(copy);
  }
  return Object.freeze(copies);
}

export function containsCanary(bytes: Uint8Array, canaries: readonly Uint8Array[]): boolean {
  for (const canary of canaries) {
    const lastStart = bytes.byteLength - canary.byteLength;
    for (let start = 0; start <= lastStart; start += 1) {
      let matched = true;
      for (let offset = 0; offset < canary.byteLength; offset += 1) {
        if (bytes[start + offset] !== canary[offset]) {
          matched = false;
          break;
        }
      }
      if (matched) return true;
    }
  }
  return false;
}

function artifactClass(path: string): string {
  const extension = extname(path).toLowerCase();
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") return "JavaScript";
  if (extension === ".css") return "CSS";
  if (extension === ".html" || extension === ".htm") return "HTML";
  if (extension === ".map") return "source map";
  if (extension === ".json") return "manifest or JSON";
  return "binary";
}

export async function scanCanarySecretArtifacts(
  outputRoot: string,
  canaries: readonly Uint8Array[]
): Promise<void> {
  let canonicalRoot: string;
  try {
    const rootMetadata = await lstat(outputRoot);
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) throw new Error("invalid");
    canonicalRoot = await realpath(outputRoot);
  } catch {
    failure("The final output directory could not be inspected safely");
  }

  let files = 0;
  let totalBytes = 0;
  let ordinal = 0;

  async function visit(directory: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) failure("The output directory depth limit was exceeded");
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      failure("A generated output directory could not be read safely");
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const candidate = resolve(directory, entry.name);
      let metadata: Stats;
      let canonicalCandidate: string;
      try {
        metadata = await lstat(candidate);
        if (metadata.isSymbolicLink()) throw new Error("link");
        canonicalCandidate = await realpath(candidate);
        if (!contained(canonicalRoot, canonicalCandidate)) throw new Error("escape");
      } catch {
        failure("A generated output entry could not be inspected safely");
      }
      if (metadata.isDirectory()) {
        await visit(canonicalCandidate, depth + 1);
        continue;
      }
      if (!metadata.isFile()) failure("Generated output contains an unsupported entry type");
      files += 1;
      ordinal += 1;
      if (files > MAX_FILES) failure("The generated file count limit was exceeded");
      if (metadata.size > MAX_FILE_BYTES) failure("The generated file byte limit was exceeded");
      totalBytes += metadata.size;
      if (totalBytes > MAX_TOTAL_BYTES) failure("The generated output byte limit was exceeded");
      let bytes: Uint8Array;
      try {
        bytes = await readFile(canonicalCandidate);
      } catch {
        failure("A generated artifact could not be read safely");
      }
      if (containsCanary(bytes, canaries))
        failure(
          `Canary secret detected in ${artifactClass(canonicalCandidate)} artifact ${ordinal}`
        );
    }
  }

  await visit(canonicalRoot, 0);
}
