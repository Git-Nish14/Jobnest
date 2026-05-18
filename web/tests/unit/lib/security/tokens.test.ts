/**
 * Unit tests for lib/security/tokens.ts
 *
 * These are pure crypto tests — no Supabase or network mocks needed.
 * The CSRF_SECRET is set in vitest-setup.ts.
 */
import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "@/lib/security/tokens";

describe("encryptToken / decryptToken — roundtrip", () => {
  it("decrypts an encrypted token back to the original value", () => {
    const plaintext = "gho_abcdef1234567890ABCDEF";
    const ciphertext = encryptToken(plaintext);
    expect(decryptToken(ciphertext)).toBe(plaintext);
  });

  it("produces ciphertext that is base64-encoded and not equal to plaintext", () => {
    const plaintext = "gho_secret_token";
    const ciphertext = encryptToken(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    // Should be valid base64
    expect(() => Buffer.from(ciphertext, "base64")).not.toThrow();
  });

  it("generates different ciphertext each call (random IV)", () => {
    const plaintext = "gho_same_token";
    const c1 = encryptToken(plaintext);
    const c2 = encryptToken(plaintext);
    expect(c1).not.toBe(c2);
    // But both decrypt to the same value
    expect(decryptToken(c1)).toBe(plaintext);
    expect(decryptToken(c2)).toBe(plaintext);
  });

  it("roundtrips a GitHub OAuth token shape", () => {
    // Deliberately short (< 36 chars after prefix) so secret scanners don't flag it.
    // The roundtrip test only needs a gho_-prefixed string; exact length is irrelevant.
    const token = "gho_unit_test_placeholder";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("roundtrips a GitHub PAT shape", () => {
    // Same reasoning — short enough to avoid secret-scanner false positives.
    const token = "ghp_unit_test_placeholder";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("roundtrips a long token without truncation", () => {
    const token = "x".repeat(200);
    expect(decryptToken(encryptToken(token))).toBe(token);
  });
});

describe("decryptToken — legacy plaintext token passthrough", () => {
  it("returns gho_ token as-is without decrypting", () => {
    const raw = "gho_legacy_token_abc123";
    expect(decryptToken(raw)).toBe(raw);
  });

  it("returns ghp_ token as-is without decrypting", () => {
    const raw = "ghp_legacy_pat_abc123";
    expect(decryptToken(raw)).toBe(raw);
  });

  it("returns github_pat_ token as-is without decrypting", () => {
    const raw = "github_pat_11AABB_sometoken";
    expect(decryptToken(raw)).toBe(raw);
  });
});

describe("decryptToken — invalid input handling", () => {
  it("returns null for empty string", () => {
    expect(decryptToken("")).toBeNull();
  });

  it("returns null for a random non-base64 string", () => {
    expect(decryptToken("not-a-valid-encrypted-blob!!!")).toBeNull();
  });

  it("returns null for a base64 blob that is too short", () => {
    // Less than 29 bytes encoded
    const tooShort = Buffer.from("hello").toString("base64");
    expect(decryptToken(tooShort)).toBeNull();
  });

  it("returns null for a valid-length base64 blob with wrong key (tampered ciphertext)", () => {
    const encrypted = encryptToken("original");
    // Tamper: flip a byte in the ciphertext portion
    const buf = Buffer.from(encrypted, "base64");
    buf[30] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(decryptToken(tampered)).toBeNull();
  });
});
