import { randomInt, timingSafeEqual } from "crypto";

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

export { OTP_LENGTH, OTP_EXPIRY_MINUTES };
