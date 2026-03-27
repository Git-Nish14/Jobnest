import { randomInt, timingSafeEqual, createHash } from "crypto";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

export interface OTPData {
  code: string;
  expiresAt: Date;
}

/**
 * Generate a cryptographically secure OTP using crypto.randomInt
 */
export function generateOTP(length: number = OTP_LENGTH): OTPData {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += randomInt(0, 10).toString();
  }

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  return { code, expiresAt };
}

/**
 * Verify OTP with timing-safe comparison
 */
export function verifyOTP(
  inputCode: string,
  storedCode: string,
  expiresAt: Date
): { valid: boolean; error?: string } {
  // Check expiration
  if (new Date() > expiresAt) {
    return { valid: false, error: "OTP has expired" };
  }

  // Validate format
  if (inputCode.length !== storedCode.length) {
    return { valid: false, error: "Invalid OTP" };
  }

  // Timing-safe comparison
  const inputBuffer = Buffer.from(inputCode);
  const storedBuffer = Buffer.from(storedCode);

  const isValid = timingSafeEqual(inputBuffer, storedBuffer);

  return isValid ? { valid: true } : { valid: false, error: "Invalid OTP" };
}

/**
 * Check if OTP is expired
 */
export function isOTPExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Hash an OTP code with SHA-256 before storing.
 * Centralised here so every route uses the same algorithm — if the
 * algorithm changes, only this file needs updating.
 */
export function hashOTP(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Timing-safe comparison of two strings.
 * Returns false immediately if lengths differ (no early exit leaks length).
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export { OTP_LENGTH, OTP_EXPIRY_MINUTES };
