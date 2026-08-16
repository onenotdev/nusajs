# Product Principles and Users

## Non-negotiable principles

### P1 — Explicit over magical

Rendering, caching, runtime requirements, side effects, and data boundaries must be discoverable from route code or tooling. Convention may reduce boilerplate but must not hide consequences.

### P2 — Static until dynamic

A page starts as static output. Browser JavaScript, server execution, hydration, and streaming are added only when a declared capability requires them.

### P3 — Web Standards at boundaries

Use Web-Standard objects and semantics at runtime boundaries. Vendor APIs belong in adapters or capability extensions.

### P4 — Types describe runtime reality

Types must never promise unavailable runtime behavior. Generated types must be deterministic and inspectable.

### P5 — One mental model

A loader reads, an action mutates, an endpoint controls a response, a renderer produces UI, and an adapter connects a runtime. These terms must retain the same meaning in development, testing, and production.

### P6 — Portable core, optimized adapters

Core remains portable. Adapters may expose vendor optimizations through capability detection without changing application semantics.

### P7 — Debuggability is a feature

Every optimization must be explainable: why a route is dynamic, why JavaScript is shipped, what is cached, and which dependency increases a bundle.

### P8 — Secure defaults with visible escape hatches

Defaults must be safe. Escape hatches require explicit names, documented risks, and build warnings when appropriate.

### P9 — Small stable core

Authentication providers, ORMs, CMSs, commerce, UI kits, and vendor services remain plugins. Core contains only broadly required primitives.

### P10 — Measure before claiming

Performance claims require a fixture, environment, versions, command, warm-up policy, sample count, and raw results.

### P11 — Migration is part of API design

New APIs must consider migration from old APIs. Deprecations require warnings, documentation, and codemods where practical.

### P12 — Accessibility and resilience

Navigation, forms, errors, and loading states follow web semantics. Enhancement must not break basic functionality without JavaScript unless the route explicitly selects client-only behavior.

## Primary personas

### Persona A — Independent developer

Needs fast setup, clear documentation, minimal initial decisions, affordable deployment, and a path to scale without rewriting.

Job to be done: “When I start a web product, I want routing, rendering, data, and deployment to work safely so I can focus on product features.”

### Persona B — Product engineering team

Needs rapid iteration, consistent conventions, testing, preview environments, observability, and easy onboarding.

Job to be done: “When many engineers change an application, we want consistent boundaries so changes are safe and reviewable.”

### Persona C — Platform or enterprise team

Needs policy enforcement, internal adapters, tracing, security controls, dependency governance, self-hosting, and planned upgrades.

Job to be done: “When we operate many applications, we need a portable and auditable framework standard.”

### Persona D — Plugin or library author

Needs stable extension APIs, clear lifecycle hooks, semantic versioning, test harnesses, and compatibility documentation.

### Persona E — Runtime or hosting provider

Needs adapter contracts, conformance tests, manifests, streaming, cache hooks, assets, and observability integration.

## Critical user journeys

### First run

The user runs the generator, answers only necessary questions, starts the dev server, sees a working page, and receives clear next steps.

### Add a data-backed page

The user creates a route, adds a typed loader, selects rendering and caching, consumes inferred data, and inspects the result.

### Perform a safe mutation

The user defines an input schema and action/server function, submits a progressively enhanced form or typed client call, receives structured errors, and explicitly invalidates related cache entries.

### Deploy to another runtime

The user installs an adapter, receives capability diagnostics, runs conformance checks, previews production artifacts locally, and deploys without changing route semantics.

### Debug performance

The user inspects render mode, hydration boundaries, bundle composition, cache behavior, and the dependency that forced a route to become dynamic.

## Feature decision questions

Before accepting a feature, answer:

- Is it required by most web applications?
- Should it be a plugin?
- Does it increase client payload?
- Does it require a specific runtime?
- How does it behave without JavaScript?
- How can users inspect and debug it?
- What are the security and privacy risks?
- How is it tested across adapters?
- How is it deprecated or removed?

