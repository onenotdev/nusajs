#!/usr/bin/env node
import { runCli } from "./index.js";

const result = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  writeError: (message) => console.error(message),
  writeOutput: (message) => console.log(message)
});

process.exitCode = result.exitCode;
