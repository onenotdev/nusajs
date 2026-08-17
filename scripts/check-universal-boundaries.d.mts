export interface UniversalPackageBoundary {
  readonly name: string;
  readonly root: string;
}

export type BoundaryViolationCode = "NUSA_BOUNDARY_NODE_BUILTIN" | "NUSA_BOUNDARY_INSECURE_RANDOM";

export interface BoundaryViolation {
  readonly code: BoundaryViolationCode;
  readonly package: string;
  readonly file: string;
  readonly specifier: string;
}

export interface ScanUniversalPackagesOptions {
  readonly repositoryRoot?: string;
  readonly packages?: readonly UniversalPackageBoundary[];
}

export declare const universalPackages: readonly UniversalPackageBoundary[];

export declare function scanUniversalPackages(
  options?: ScanUniversalPackagesOptions
): Promise<readonly BoundaryViolation[]>;

export declare function formatBoundaryViolation(violation: BoundaryViolation): string;
