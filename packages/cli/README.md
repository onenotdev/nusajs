# `@nusajs/cli`

Private Node.js command-line infrastructure for NusaJS. The package and provisional `nusajs` binary are experimental and provide no stability promise.

```text
nusajs dev [--root <path>] [--host <host>] [--port <port>]
nusajs build [--root <path>] [--out-dir <path>] [--sourcemap]
nusajs preview [--root <path>] [--host <host>] [--port <port>]
```

Development and preview bind to `127.0.0.1` by default. A non-loopback `--host` is explicit network exposure and prints `NUSA-CLI-0002`; it does not bypass Vite's Host/origin checks. Production source maps are disabled unless `--sourcemap` is supplied. The CLI does not spawn child processes or publish build artifacts.
