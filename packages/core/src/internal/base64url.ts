const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Encodes bytes as unpadded base64url (RFC 4648 §5) without padding characters.
 *
 * Package-internal and deterministic, so token generation can be verified without a public
 * random-source injection seam. Not part of the public API.
 */
export function encodeBase64Url(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triplet = (first << 16) | (second << 8) | third;
    result += alphabet[(triplet >> 18) & 63] ?? "";
    result += alphabet[(triplet >> 12) & 63] ?? "";
    result += index + 1 < bytes.length ? (alphabet[(triplet >> 6) & 63] ?? "") : "";
    result += index + 2 < bytes.length ? (alphabet[triplet & 63] ?? "") : "";
  }
  return result;
}
