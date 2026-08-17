import { createHash } from "node:crypto";

export const id = "harness-calibration";
export const kind = "harness-overhead";
export const cacheState = "warm in-process deterministic calibration";
export const configHash = createHash("sha256").update("harness-calibration-v1").digest("hex");
export const claimScope =
  "Harness calibration only. This result is not framework performance and may not be used for marketing.";

export async function prerequisites() {
  const input = "<script>alert('calibration')</script>";
  const escaped = input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  return {
    correctness: escaped === "&lt;script&gt;alert('calibration')&lt;/script&gt;" ? "pass" : "fail",
    security: !escaped.includes("<script>") ? "pass" : "fail",
    checks: [
      "deterministic arithmetic produces the expected value",
      "hostile calibration text is escaped before it reaches an HTML-shaped sink"
    ]
  };
}

export async function measure() {
  let state = 0x811c9dc5;
  for (let index = 0; index < 20_000; index += 1) {
    state ^= index;
    state = Math.imul(state, 0x01000193);
  }
  return state >>> 0;
}
