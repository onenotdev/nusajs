# ADR-001: Temporary codename and package scope

- Status: Accepted
- Date: 2026-08-15
- Owner: Repository owner, recorded by GitHub Copilot (`gpt-pro`) under delegated autonomy
- Related tasks: FW-001, FW-002
- Security impact: low

## Context

Every normative document uses the placeholder `[FRAMEWORK_NAME]`, while the repository directory is `nusajs-framework`. FW-002 cannot create a workspace without package names, and inconsistent naming would immediately violate the terminology requirement validated by FW-001.

Trademark, domain, GitHub organization, and npm scope verification are not complete, so a permanent public name cannot be committed yet.

## Decision drivers

- FW-002 requires concrete package identifiers.
- Documentation must stop mixing an unresolved placeholder with an implied real name.
- A permanent public identity must not be claimed before legal and registry checks.
- Renaming later must remain mechanical and low risk.

## Options

### Option A — Keep `[FRAMEWORK_NAME]` in code as well

Benefits: no premature naming.  
Disadvantages: not a legal package identifier, blocks the workspace, produces unusable configuration, and increases confusion.

### Option B — Adopt a permanent public name now

Benefits: single rename, immediate branding.  
Disadvantages: requires trademark, domain, organization, and registry clearance that does not exist; a forced later rename would break published identifiers and documentation.

### Option C — Adopt an explicitly temporary internal codename and reserved scope

Benefits: unblocks implementation, keeps one consistent identifier, and states clearly that the name is provisional.  
Disadvantages: a later rename touches package names, imports, and documentation, though mechanically.

## Decision

Option C. The working codename is `nusajs`, and the reserved provisional npm scope is `@nusajs/*`.

The codename is internal and provisional. No publication to a public registry may occur under this scope until trademark, domain, organization, and registry checks pass and this ADR is superseded.

Normative documents keep `[FRAMEWORK_NAME]` for the public product name. Code, package metadata, and tooling use `nusajs` as the working identifier.

## Consequences

Positive: FW-002 can proceed with consistent identifiers, and provisional status stays explicit.

Negative: a future rename must update package names, workspace metadata, import specifiers, and documentation. Because no package is published yet, the change stays internal.

## Security analysis

Affected trust boundary: package publishing and supply chain.

Relevant requirements: `SEC-SUPPLY-002` and `SEC-SUPPLY-003` for controlled publishing, provenance, and least-privilege release permissions.

Abuse case: an attacker registers the unclaimed scope or a typosquatted variant and users install a hostile package.

Controls: all workspace packages remain private until an accepted release decision, no publish workflow exists in this task, and scope reservation is required before any publish.

Residual risk: the scope is unreserved on the public registry, so name-squatting remains possible until reservation completes.

## Verification

Workspace metadata uses one consistent identifier, every package is marked private, and no publish command exists in the repository.

## Rollback or supersede plan

A superseding ADR records the approved public name and scope. Renaming is a mechanical search-and-replace across package metadata, import specifiers, and documentation, executed while all packages are still private.
