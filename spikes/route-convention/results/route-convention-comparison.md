# Route convention and module API measurements

- Task: FW-004. Feeds ADR-003 and ADR-004.
- Harness: `spikes/route-convention/measure.mjs`.
- Node: `v24.16.0`. Platform: `win32`.
- TypeScript: `5.9.3`.
- Logical route set: 9 routes, 4 boundaries, 5 collision cases.

## Filesystem conventions

| Convention | Reserved names | Spellings per URL (max) | Total spellings | Group aliasing | Precedence source | Collisions reported | Unexpressible by construction | All conflicting files named |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `suffix` | 11 | 2 | 17 | yes | computed from the parsed pattern | 5 of 5 | 0 | yes |
| `folder` | 10 | 1 | 9 | yes | computed from the parsed pattern | 4 of 4 | 1 | yes |
| `manifest` | 1 | 1 | 9 | no | declaration order in the manifest | 5 of 5 | 0 | yes |

`Unexpressible by construction` counts fixture collision cases the convention cannot
even write down, because both routes resolve to the same single path. That is an
absence of an aliasing surface, not a missed detection: the case never reaches the
scanner. Cases that *are* expressible must all be reported.

- `folder`: `duplicate-static` — two files claim the same static URL — unexpressible.

### Precedence

- `suffix`: 0 overlapping pattern pairs tie on specificity, so precedence is decidable from the patterns alone.
- `folder`: 0 overlapping pattern pairs tie on specificity, so precedence is decidable from the patterns alone.
- `manifest`: 0 overlapping pattern pairs tie on specificity, so precedence is decidable from the patterns alone.

## Cross-platform filesystem probe

Measured on `win32` only. No claim is made about
platforms this run did not touch.

- Candidate paths created: 26.
- Paths rejected by the filesystem: 0.
- Case-insensitive path resolution: true.
- Unicode NFC/NFD folded to one entry: false.

| Reserved device name | As suffix file | As bare segment | As route folder |
| --- | --- | --- | --- |
| `con` | created | created | created |
| `nul` | created | created | created |
| `aux` | created | created | created |
| `prn` | created | created | created |
| `com1` | created | created | created |

## Route-module API

| Candidate | Literal config read without execution | Computed config produces diagnostic | Cross-module binding resolution required | Silent miss with a name-only matcher | Analyzer steps |
| --- | --- | --- | --- | --- | --- |
| named exports | true | true | false | false | 2 |
| `definePage()` | true | true (alias resolved) | true | true | 5 |

## Honesty notes

- The counts above are structural, deterministic, and reproduce exactly on identical inputs.
- Filesystem probe results are platform-specific and must be re-run per platform before being cited for that platform.
- No performance claim is made here. Match-time budgets belong to FW-106 and the AC-ROUTE-06 fixture.
