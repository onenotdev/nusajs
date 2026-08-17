import { describe, expect, it } from "vitest";
import { createSecureToken } from "../src/index.js";
import { encodeBase64Url } from "../src/internal/base64url.js";

const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

describe("encodeBase64Url", () => {
  it("encodes the full byte range without padding", () => {
    expect(encodeBase64Url(new Uint8Array([0x00]))).toBe("AA");
    expect(encodeBase64Url(new Uint8Array([0xfb, 0xef, 0xbe]))).toBe("----");
    expect(encodeBase64Url(new Uint8Array([0xff, 0xff]))).toBe("__8");
    expect(encodeBase64Url(new Uint8Array([0xfb, 0xff]))).toBe("-_8");
  });

  it("matches standard unpadded base64url for deterministic input", () => {
    const bytes = new Uint8Array([0x1f, 0x2e, 0x3d, 0x4c, 0x5b, 0x6a, 0x79, 0x88]);
    expect(encodeBase64Url(bytes)).toBe("Hy49TFtqeYg");
  });

  it("produces 43 characters for 32 bytes with no padding", () => {
    const token = encodeBase64Url(new Uint8Array(32));
    expect(token).toHaveLength(43);
    expect(token).not.toContain("=");
    expect(base64UrlPattern.test(token)).toBe(true);
  });
});

describe("createSecureToken", () => {
  it("returns a 43-character unpadded base64url token", () => {
    const token = createSecureToken();
    expect(token).toHaveLength(43);
    expect(base64UrlPattern.test(token)).toBe(true);
  });

  it("generates distinct tokens and requests exactly 32 random bytes", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => createSecureToken()));
    expect(tokens.size).toBe(100);
  });

  it("reads randomness from Web Crypto getRandomValues", () => {
    const original = globalThis.crypto.getRandomValues;
    const calls: number[] = [];
    const spy = (bytes: Uint8Array): Uint8Array => {
      calls.push(bytes.byteLength);
      bytes.fill(7);
      return bytes;
    };
    // biome-ignore lint/performance/noDelete: test-only global shim.
    const cryptoObject = globalThis.crypto as { getRandomValues: typeof original };
    cryptoObject.getRandomValues = spy as unknown as typeof original;
    try {
      const token = createSecureToken();
      expect(calls).toEqual([32]);
      expect(token).toBe(`${"BwcH".repeat(10)}Bwc`);
    } finally {
      cryptoObject.getRandomValues = original;
    }
  });

  it("fails closed when Web Crypto is unavailable", () => {
    const original = globalThis.crypto;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    // biome-ignore lint/performance/noDelete: test-only global shim.
    delete (globalThis as { crypto?: unknown }).crypto;
    try {
      expect(() => createSecureToken()).toThrow("[NUSA-SECURITY-0001]");
    } finally {
      if (descriptor !== undefined) {
        Object.defineProperty(globalThis, "crypto", descriptor);
      } else {
        Object.defineProperty(globalThis, "crypto", { value: original, configurable: true });
      }
    }
  });
});
