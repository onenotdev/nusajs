import { encodeBase64Url } from "./internal/base64url.js";

const tokenByteLength = 32;

function invalidTokenSource(reason: string): never {
  throw new TypeError(`[NUSA-SECURITY-0001] Secure token unavailable: ${reason}`);
}

/**
 * Creates a cryptographically secure 256-bit token encoded as unpadded base64url.
 *
 * The token is generated from `globalThis.crypto.getRandomValues` (Web Crypto) with a fixed
 * 32-byte / 256-bit entropy floor, encodes without modulo bias, and fails closed when Web Crypto
 * is unavailable. A random token provides unpredictability only, never integrity or
 * confidentiality; it must not be used as an authenticated or encrypted value.
 */
export function createSecureToken(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject === undefined || typeof cryptoObject.getRandomValues !== "function") {
    invalidTokenSource("Web Crypto is not available");
  }
  const bytes = new Uint8Array(tokenByteLength);
  cryptoObject.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}
