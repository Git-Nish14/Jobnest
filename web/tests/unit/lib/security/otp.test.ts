import { describe, it, expect } from "vitest";
import {
  generateOTP,
  verifyOTP,
  isOTPExpired,
  hashOTP,
  secureCompare,
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
} from "@/lib/security/otp";

describe("generateOTP", () => {
  it("generates a code of default length", () => {
    const { code } = generateOTP();
    expect(code).toHaveLength(OTP_LENGTH);
  });

  it("code is digits only", () => {
    const { code } = generateOTP();
    expect(/^\d+$/.test(code)).toBe(true);
  });

  it("expiry is in the future", () => {
    const { expiresAt } = generateOTP();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it(`expires roughly ${OTP_EXPIRY_MINUTES} minutes from now`, () => {
    const before = Date.now();
    const { expiresAt } = generateOTP();
    const diffMs = expiresAt.getTime() - before;
    const diffMin = diffMs / 60_000;
    expect(diffMin).toBeGreaterThanOrEqual(OTP_EXPIRY_MINUTES - 0.1);
    expect(diffMin).toBeLessThanOrEqual(OTP_EXPIRY_MINUTES + 0.1);
  });

  it("generates different codes on successive calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOTP().code));
    // With 10^6 combinations, all 20 should be unique with near-certainty
    expect(codes.size).toBeGreaterThan(1);
  });

  it("respects custom length", () => {
    const { code } = generateOTP(4);
    expect(code).toHaveLength(4);
  });
});

describe("verifyOTP", () => {
  it("returns valid for matching code before expiry", () => {
    const future = new Date(Date.now() + 60_000);
    const result = verifyOTP("123456", "123456", future);
    expect(result.valid).toBe(true);
  });

  it("returns invalid for wrong code", () => {
    const future = new Date(Date.now() + 60_000);
    const result = verifyOTP("999999", "123456", future);
    expect(result.valid).toBe(false);
  });

  it("returns invalid for expired OTP", () => {
    const past = new Date(Date.now() - 1);
    const result = verifyOTP("123456", "123456", past);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it("returns invalid for length mismatch", () => {
    const future = new Date(Date.now() + 60_000);
    const result = verifyOTP("12345", "123456", future);
    expect(result.valid).toBe(false);
  });
});

describe("isOTPExpired", () => {
  it("returns false for future date", () => {
    expect(isOTPExpired(new Date(Date.now() + 1000))).toBe(false);
  });

  it("returns true for past date", () => {
    expect(isOTPExpired(new Date(Date.now() - 1))).toBe(true);
  });
});

describe("hashOTP", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const h = hashOTP("123456");
    expect(h).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
  });

  it("is deterministic — same input produces same hash", () => {
    expect(hashOTP("999999")).toBe(hashOTP("999999"));
  });

  it("different codes produce different hashes", () => {
    expect(hashOTP("111111")).not.toBe(hashOTP("222222"));
  });
});

describe("secureCompare", () => {
  it("returns true for identical strings", () => {
    expect(secureCompare("abc", "abc")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(secureCompare("abc", "xyz")).toBe(false);
  });

  it("returns false immediately when lengths differ", () => {
    expect(secureCompare("abc", "abcd")).toBe(false);
  });

  it("works with full SHA-256 hashes", () => {
    const h = hashOTP("123456");
    expect(secureCompare(h, h)).toBe(true);
    expect(secureCompare(h, hashOTP("654321"))).toBe(false);
  });
});
