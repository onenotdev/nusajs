import type { Dirent, Stats } from "node:fs";
import { lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

/** A recognized filesystem route-module role. */
export type RouteFileKind = "page" | "endpoint" | "layout" | "error" | "loading";

/** An immutable route file discovered below the configured root. */
export interface RouteFileRecord {
  readonly kind: RouteFileKind;
  readonly relativePath: string;
  readonly normalizedPath: string;
}

/** A stable scanner failure safe for development diagnostics. */
export interface RouteScanDiagnostic {
  readonly code: "NUSA-ROUTE-0001" | "NUSA-SECURITY-0001";
  readonly message: string;
  readonly file?: string;
  readonly hint: string;
}

/** Input for deterministic filesystem route discovery. */
export interface RouteScanOptions {
  readonly root: string;
}

/** Aggregate failure containing every deterministic scanner diagnostic. */
export class RouteScanError extends Error {
  readonly diagnostics: readonly Readonly<RouteScanDiagnostic>[];

  constructor(diagnostics: readonly RouteScanDiagnostic[]) {
    super(`[${diagnostics[0]?.code ?? "NUSA-ROUTE-0001"}] Route scan failed`);
    this.name = "RouteScanError";
    this.diagnostics = Object.freeze(diagnostics.map((diagnostic) => Object.freeze(diagnostic)));
  }
}

const routeFilePattern = /^(.*)\.(page|endpoint)\.(ts|tsx|js|jsx|mts|mjs|cts|cjs)$/;
const boundaryFilePattern = /^_(layout|error|loading)\.(ts|tsx|js|jsx|mts|mjs|cts|cjs)$/;
const reservedDevicePattern = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function portablePath(path: string): string {
  return path.split(sep).join("/");
}

function isContained(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function classify(filename: string): RouteFileKind | undefined {
  const boundary = boundaryFilePattern.exec(filename);
  if (boundary !== null) return boundary[1] as "layout" | "error" | "loading";
  const route = routeFilePattern.exec(filename);
  if (route === null || route[1] === "") return undefined;
  return route[2] as "page" | "endpoint";
}

function hasReservedSegment(relativePath: string): boolean {
  return relativePath.split("/").some((segment) => {
    const route = routeFilePattern.exec(segment);
    const boundary = boundaryFilePattern.exec(segment);
    const name = route?.[1] ?? boundary?.[1] ?? segment;
    return reservedDevicePattern.test(name);
  });
}

function diagnostic(
  code: RouteScanDiagnostic["code"],
  message: string,
  hint: string,
  file?: string
): RouteScanDiagnostic {
  return { code, message, ...(file === undefined ? {} : { file }), hint };
}

/**
 * Enumerates route modules without importing, parsing, or executing application code.
 *
 * Every returned path is root-relative, NFC-normalized, and sorted by its portable collision key.
 */
export async function scanRouteFiles(
  options: RouteScanOptions
): Promise<readonly RouteFileRecord[]> {
  if (!isAbsolute(options.root)) {
    throw new RouteScanError([
      diagnostic("NUSA-SECURITY-0001", "Route root must be absolute", "Pass an absolute route root")
    ]);
  }

  const lexicalRoot = resolve(options.root);
  let root: string;
  try {
    const rootMetadata = await lstat(lexicalRoot);
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
      throw new Error("unsafe root");
    root = await realpath(lexicalRoot);
  } catch {
    throw new RouteScanError([
      diagnostic(
        "NUSA-SECURITY-0001",
        "Route root must resolve to a readable directory",
        "Create the route directory and verify its permissions"
      )
    ]);
  }

  const records: RouteFileRecord[] = [];
  const diagnostics: RouteScanDiagnostic[] = [];
  const visitedDirectories = new Set<string>();

  async function visit(directory: string): Promise<void> {
    const sourceDirectory = portablePath(relative(root, directory));
    let entries: Dirent[];
    try {
      const canonicalDirectory = await realpath(directory);
      if (!isContained(root, canonicalDirectory)) throw new Error("escaped root");
      if (visitedDirectories.has(canonicalDirectory)) return;
      visitedDirectories.add(canonicalDirectory);
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      diagnostics.push(
        diagnostic(
          "NUSA-SECURITY-0001",
          "Route directory cannot be inspected safely",
          "Remove links and verify route-directory permissions",
          sourceDirectory || "."
        )
      );
      return;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const candidate = resolve(directory, entry.name);
      const sourcePath = portablePath(relative(root, candidate));
      let metadata: Stats;
      try {
        metadata = await lstat(candidate);
      } catch {
        diagnostics.push(
          diagnostic(
            "NUSA-SECURITY-0001",
            "Route entry cannot be inspected safely",
            "Remove broken entries and verify route-tree permissions",
            sourcePath
          )
        );
        continue;
      }
      if (entry.isSymbolicLink() || metadata.isSymbolicLink()) {
        diagnostics.push(
          diagnostic(
            "NUSA-SECURITY-0001",
            "Route tree must not contain symbolic links",
            "Replace the link with a regular file or directory",
            sourcePath
          )
        );
        continue;
      }
      if (metadata.isDirectory()) {
        await visit(candidate);
        continue;
      }
      if (!metadata.isFile()) continue;
      const kind = classify(entry.name);
      if (kind === undefined) continue;
      if (hasReservedSegment(sourcePath)) {
        diagnostics.push(
          diagnostic(
            "NUSA-ROUTE-0001",
            "Route path contains a Windows reserved device name",
            "Rename the reserved route segment",
            sourcePath
          )
        );
        continue;
      }
      records.push(
        Object.freeze({
          kind,
          relativePath: sourcePath,
          normalizedPath: sourcePath.normalize("NFC")
        })
      );
    }
  }

  await visit(root);
  const keys = new Map<string, RouteFileRecord[]>();
  for (const record of records) {
    const key = record.normalizedPath.toLocaleLowerCase("en-US");
    const conflicts = keys.get(key) ?? [];
    conflicts.push(record);
    keys.set(key, conflicts);
  }
  for (const conflicts of keys.values()) {
    if (conflicts.length < 2) continue;
    for (const conflict of conflicts) {
      diagnostics.push(
        diagnostic(
          "NUSA-ROUTE-0001",
          `Route file collides after case-folding and NFC normalization: ${conflicts.map((item) => item.relativePath).join(", ")}`,
          "Rename the files so their portable normalized paths are unique",
          conflict.relativePath
        )
      );
    }
  }
  diagnostics.sort((left, right) =>
    `${left.file ?? ""}\0${left.message}`.localeCompare(
      `${right.file ?? ""}\0${right.message}`,
      "en"
    )
  );
  if (diagnostics.length > 0) throw new RouteScanError(diagnostics);
  records.sort((left, right) =>
    left.normalizedPath
      .toLocaleLowerCase("en-US")
      .localeCompare(right.normalizedPath.toLocaleLowerCase("en-US"), "en")
  );
  return Object.freeze(records);
}
