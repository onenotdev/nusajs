# ADR-034: Nested Layout Branch and Rendering Contract

- Status: Proposed
- Date: 2026-08-18
- Owner: framework maintainers
- Related tasks: FW-201, FW-202, FW-203, FW-208
- Security impact: medium

## Context

The compiler recognizes `_layout` boundaries and computes their URL scopes, but discards all
boundaries from route-manifest v1. Runtime bindings load one page value and the renderer accepts one
complete value, so no route branch or composition operation exists. Parent-to-child rendering and the
filesystem spelling are normative, while layout module input, grouped-layout ambiguity, manifest
representation/version, and renderer ownership are not.

## Proposed decision

The compiler computes one immutable ordered layout chain for every page at build time. Order is root
to nearest child. Layouts apply only to pages in their structural directory subtree; endpoints never
receive layouts. Structural group identity is retained even though groups do not contribute URL
segments. More than one layout that could occupy the same structural branch position is a stable
build error rather than filesystem-order precedence.

Introduce route-manifest v2. Each page entry records its ordered layouts as immutable `{ file, scope }`
records; endpoint entries record no layouts. Existing route IDs and URL patterns remain unchanged.
Consumers reject unsupported versions. No runtime reconstructs ancestry from URL strings.

For FW-201, `_layout.tsx` has one default renderer-specific component receiving only read-only
`children`. Layouts have no loader, implicit request-context prop, status/header mutation, metadata,
error handling, or `Response` short-circuit. Those capabilities remain with FW-203, FW-208, and
FW-202 and require their own contracts. Static analysis never imports or executes layout modules.

Core owns a renderer-neutral immutable branch description and request-local dispatch, but imports no
Preact API. Renderer implementations own conversion of renderer-specific page/layout components into
a renderable tree. The Preact renderer wraps from nearest child back to root so observable output is
parent to child to page. Existing escaping, abort propagation, streaming validation, and exact-once
cleanup remain mandatory.

Generated application glue imports runtime route modules only in the runtime bundle, binds each
manifest page to its ordered layout modules, and creates no mutable cross-request branch state.

## Consequences

Manifest v2 is an intentional compatibility boundary and requires migration guidance. The minimal
children-only API delivers nested visual structure without pre-empting data, metadata, or boundary
semantics. Other renderers can implement the same branch operation without routing changes. Group
identity must be retained beyond the current erased URL scope.

## Required evidence

- Root, nested, sibling-exclusion, dynamic, grouped, duplicate, and reversed-input compiler tests.
- Manifest v2 serialization, version rejection, type tests, and migration documentation.
- Observable `root(child(page))` output with each participant exactly once.
- Core imports no renderer implementation; Preact escaping remains intact through every wrapper.
- Abort and concurrent-request isolation tests across composition.
- Kernel fixture through compiler, matcher, handler, Preact renderer, and Node transport for GET,
  HEAD, 404, dynamic parameters, and endpoint exclusion.
- TSDoc, public type tests, runtime tests, executable example, release notes, and full quality gates.

## Approval required

A maintainer must accept, amend, or reject layout module semantics, structural group behavior,
manifest v2, and renderer composition ownership before implementation changes public contracts.
