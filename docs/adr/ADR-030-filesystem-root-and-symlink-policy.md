# ADR-030: Filesystem Root and Symlink Policy

- Status: Proposed
- Date: 2026-08-17
- Owner: framework maintainers
- Related tasks: FW-119, FW-104, FW-115
- Security impact: high

## Context

Project files and links are untrusted compiler inputs. Lexical containment alone does not prevent a config file or route root inside an application tree from resolving outside that tree. Existing route discovery also allowed in-root aliases, making route identity depend on link spelling. The security PRD requires canonical containment and a documented symlink policy.

## Decision drivers

- Fail closed across Windows, macOS, and Linux without platform-specific race-prone exceptions.
- Keep route identity deterministic and independent of filesystem aliases.
- Prevent config reads, watches, and route enumeration outside the declared application root.
- Avoid exposing absolute host paths or raw filesystem causes in user-facing diagnostics.

## Options

### Option A: Allow links whose canonical targets remain inside the root

This supports linked development trees, but requires alias ownership rules, cycle and duplicate handling, component-by-component revalidation, and platform-specific reparse-point semantics. It retains time-of-check/time-of-use ambiguity.

### Option B: Reject framework-managed links

Application roots, config files, route roots, route directories, and route files must be regular non-link entries. Lexical and canonical containment are both checked before framework reads, watches, or scans them. This is less flexible but deterministic and portable.

## Decision

Adopt Option B for v0.x strict behavior. The CLI rejects a linked application root before invoking Vite. The compiler rejects linked config and route roots, and route discovery rejects every link entry, including internal aliases, escaping links, and broken links. Failures use stable redacted diagnostics.

Output directories, static asset serving, source viewing, stack-frame resolution, inspector access, and HMR network policy remain assigned to their dedicated tasks. This ADR does not claim complete `SEC-DEV-002`, `SEC-FILE-003`, `AC-COMP-07`, or `AC-SEC-07` conformance.

## Consequences

The policy removes symlink-based monorepo route sharing in v0.x. Users must use regular project files or tooling that materializes them. Route records remain deterministic and cannot be duplicated through aliases. A future explicit opt-in may supersede this policy only with equivalent containment, identity, race, and cross-platform evidence.

## Security analysis

The affected trust boundary is project filesystem input (`SEC-INPUT-004`). Controls are no-follow metadata checks, lexical and canonical root containment, rejection before read/watch/scan, deterministic scanner diagnostics, and path/cause redaction. Pathname-based Node APIs cannot eliminate replacement races between validation and use; rejection is rechecked at each framework-owned boundary, while hostile concurrent mutation remains residual local-machine risk.

## Verification

Automated tests cover linked application roots, linked config and route roots, internal and escaping route links, linked route files where host privileges permit creation, deterministic diagnostics, redaction, strict TypeScript, universal boundaries, and real Vite builds.

## Rollback or supersede plan

Supersede this ADR with a versioned opt-in link policy only after cross-platform tests define canonical identity, cycle/alias behavior, replacement-race limits, diagnostics, and migration guidance. Secure strict-mode defaults must not be weakened silently.