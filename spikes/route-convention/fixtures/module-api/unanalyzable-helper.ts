// FW-004 module API fixture support: a helper the compiler cannot evaluate.
//
// Never imported by framework code. Exists only so that
// ./named-exports-dynamic.ts has an unanalyzable initialiser.

export function readRuntimeFromEnvironment(): string {
  return "server";
}
