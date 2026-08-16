# Security Review — [Feature or Task]

- Task/PR:
- Reviewer:
- Date:
- Risk: none | low | medium | high | critical
- Relevant `SEC-*` requirements:

## Change summary

Describe the behavior and public API change.

## Assets affected

- Secrets
- Identity/session
- User data
- Cache
- Filesystem
- Build pipeline
- Client bundle
- Availability
- Other

## Trust boundaries

List every new or changed boundary and identify the untrusted input.

## Abuse cases

1. An attacker ...
2. A malicious plugin ...
3. A misconfigured application ...

## Controls

Map each abuse case to prevention, detection, and recovery controls.

## Data handling

- Inputs and validation:
- Serialization and escaping:
- Logs and redaction:
- Cache behavior:
- Retention:

## Resource controls

- Size/depth limits:
- Timeout/abort:
- Concurrency:
- Cleanup:

## Dependencies and supply chain

New dependencies, licenses, install scripts, provenance, and maintenance assessment.

## Verification evidence

- Unit/property/fuzz:
- Browser/integration:
- Adapter conformance:
- Manual review:
- Production artifact scan:

## Residual risk

State accepted risks, owner, expiry date, and required follow-up.

## Decision

Approved | changes required | rejected

