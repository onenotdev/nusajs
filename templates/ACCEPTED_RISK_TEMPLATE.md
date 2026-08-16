# Accepted Risk — [Short title]

Copy this file into `docs/SECURITY_ACCEPTED_RISKS.md` as a new record. A record kept
anywhere else does not count as evidence (`docs/SECURITY_EVIDENCE_WORKFLOW.md` section 3.1).

All ten fields are mandatory. "TBD" is not a value.

## AR-nnn — [Short title]

- Status: PROPOSED | ACCEPTED | RENEWED | RETIRED | EXPIRED | BREACHED
- Requirements: `SEC-FAMILY-nnn` (`P0` | `P1`), ... or `process`
- Scope: what is exposed, and explicitly what is not
- Rationale: why the requirement cannot be discharged now
- Compensating controls: each one independently verifiable
- Owner: role or person accountable for remediation
- Approved by: approver, or `none` with the reason approval is withheld
- Recorded: YYYY-MM-DD
- Review by: YYYY-MM-DD | M0..M7 | before FW-nnn is marked DONE
- Remediation: the concrete action that retires this record, and who takes it

Notes:

- An agent may not promote a record covering a `P0` requirement to `ACCEPTED`
  (`docs/SECURITY_EVIDENCE_WORKFLOW.md` section 6.3).
- No record may cover a defect class in the stable-release blocker policy of
  `docs/09_SECURITY_PRD.md` section 26.
- Retire records rather than deleting them; a deleted record destroys the audit trail.
