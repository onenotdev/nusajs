# ADR-032: Development-Server Network Security

- Status: Proposed
- Date: 2026-08-18
- Owner: framework maintainers
- Related tasks: FW-121, FW-115, FW-123, FW-206, FW-307, FW-308
- Security impact: high

## Context

The development server is a privileged browser-to-workstation boundary. The Security PRD requires
loopback binding by default, explicit and visible network exposure, Host and Origin validation,
per-session authentication for exposed HMR/inspector/RPC traffic, secret-safe diagnostics, and
bounded payload, connection, and message rates. The current private CLI delegates directly to Vite,
accepts an arbitrary `--host`, and emits a pre-bind warning without accessible URLs.

The approved security coverage map assigns development-endpoint payload, connection, and message-rate
limits (`SEC-DEV-005`) to FW-121. Accepted ADR-029 instead says that FW-206 owns rate limiting, while
FW-206 is scoped to application middleware and authorization hooks. This ownership conflict must be
resolved before FW-121 implementation.

## Decision drivers

- Deny DNS-rebinding, cross-origin, unauthenticated, and cross-session access before privileged dev
  handlers execute.
- Keep tokens out of navigational URLs, logs, diagnostics, overlays, headers visible to unrelated
  origins, and generated production artifacts.
- Use the existing reviewed secure-random policy rather than duplicate cryptography.
- Keep all mutable counters, credentials, listeners, and timers local to one server lifecycle.
- Preserve the compiler's no-network-endpoint boundary and avoid a stable public API.
- Fail closed when secure controls cannot be installed or enforced through supported Vite hooks.

## Proposed decision

The private CLI owns the base development-server network policy. The compiler plugin remains free of
network endpoints. Preview remains outside this development-session protocol.

`nusajs dev` binds to numeric IPv4 loopback by default. Network exposure requires a dedicated,
command-local explicit flag; a generic Host override is not sufficient authorization. After a
successful bind, exposure emits `NUSA-CLI-0002` with normalized accessible URLs and without any
credential, project path, environment value, request data, or caught cause.

Each exposed server creates one fresh 256-bit session token through the framework's existing
`createSecureToken()` policy before listening. Randomness failure refuses exposure. The credential is
transported only through a narrowly scoped HMR/dev-protocol bootstrap and authenticated upgrade or
initial protocol message selected after validating Vite's supported integration surface. It must not
appear in a query string, ordinary page URL, terminal output, diagnostic, serialized config, or
production output. Credentials from another server lifecycle are invalid.

The CLI derives an exact Host allowlist from normalized bound addresses and advertised URLs. It
rejects missing, duplicated, malformed, ambiguous, or unapproved Host values and validates browser
Origin as an exact tuple of scheme, normalized host, and effective port. `null`, credential-bearing,
deceptive-suffix, cross-scheme, and cross-port origins are denied. Exceptions in any check deny the
operation without reflecting attacker-controlled values.

FW-121 owns connection, payload, and message-rate limits for development HTTP/WebSocket/HMR,
inspector, and RPC transport. FW-206 owns application request middleware and application-level rate
limiting. This amends ADR-029 only after maintainer acceptance; until then FW-121 remains blocked.
Limits are fixed conservative private defaults for v0.x, reject excess work, release accounting on
close/error/shutdown, and cannot be raised by request content. No mutable state is shared across
servers.

FW-121 establishes the base transport boundary and current-surface redaction evidence. FW-308 owns
component/loader/route HMR semantics built on that boundary. FW-307 owns future overlay rendering and
mismatch-diagnostic redaction. FW-121 must not claim those later surfaces complete.

## Alternatives

1. Rely only on Vite defaults. Rejected because NusaJS cannot demonstrate its own exact Host,
   exposure, session, limit, and redaction contract.
2. Put network policy in the compiler plugin. Rejected because network lifecycle is CLI-owned and
   compiler ownership would mix build analysis with privileged server state.
3. Put the token in a query string or ordinary cookie. Rejected because URLs leak through history,
   logs, referrers, overlays, and screenshots, while ordinary cookies broaden ambient authority.
4. Defer dev transport limits to FW-206. Not recommended because it conflicts with the approved
   `SEC-DEV-005` coverage map and separates limits from the lifecycle that owns connections/messages.
5. Duplicate token generation in the CLI. Rejected because custom or divergent cryptographic policy
   is prohibited.

## Security analysis

The principal threats are DNS rebinding, hostile-site WebSocket access, local-network attackers,
credential disclosure/replay, parser ambiguity, and resource exhaustion. Exact normalized allowlists,
Origin tuple checks, fresh session credentials, no-reflection diagnostics, bounded state, and
fail-closed setup address those threats. A compromised dependency or developer workstation remains
outside this control. Vite surfaces that cannot be constrained through supported hooks must be
disabled rather than wrapped permissively.

## Acceptance evidence required

- Default loopback and explicit-exposure CLI tests on supported host representations.
- Post-bind accessible-URL warning snapshots with token/path/cause redaction assertions.
- Real HTTP and WebSocket tests for hostile, malformed, duplicate, and ambiguous Host/Origin input.
- Missing, malformed, incorrect, stale, and cross-session credential tests.
- Secure-random failure proving exposed startup refuses without fallback.
- Traversal/symlink corpus against every retained source-view or stack-frame endpoint.
- Payload, concurrent-connection, and message-rate exhaustion/recovery tests.
- Shutdown tests proving listener, timer, counter, and token-bearing state disposal.
- Production artifact tests proving no dev-session code or credential is emitted.
- Full formatting, lint, strict type, boundary, runtime, vulnerability, and license gates.

## Approval required

A maintainer must accept, amend, or reject this ADR and explicitly resolve the ADR-029 versus
`SEC-DEV-005` ownership conflict. Implementation may not begin while the conflict remains.
