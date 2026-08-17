# `@nusajs/compiler`

Private Node.js compiler infrastructure for NusaJS. It is not a supported application API.

`scanRouteFiles()` discovers suffix-convention route modules under an explicit absolute root. It
does not execute route modules. Results are immutable, portable, NFC-normalized, and deterministic.
Unsafe roots, escaping symlinks, reserved device names, and portable path collisions fail closed.