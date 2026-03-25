import { describe, it, expect } from "vitest";
import {
  generateOTP,
  verifyOTP,
  isOTPExpired,
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
