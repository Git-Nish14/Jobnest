import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for OAuth access tokens stored in the database.
 * The encryption key is derived from CSRF_SECRET (already a required env var).
 *
 * Format of encrypted blob (base64):  IV(12) || AuthTag(16) || Ciphertext
 * Legacy raw tokens (starting with "gho_" or "ghp_") are returned as-is when
 * decrypting — this allows the cron job to handle tokens stored before this
 * change was deployed. Users who re-connect get encrypted tokens automatically.
 */

function deriveKey(): Buffer {
  const secret = process.env.CSRF_SECRET;
  if (!secret) throw new Error("CSRF_SECRET is required for token encryption");
  return createHash("sha256").update(secret).digest();
}

/** Encrypt a plaintext token. Returns a base64 string. */
export function encryptToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a token stored by encryptToken.
 * Returns the plaintext token, or null if decryption fails.
 * Raw legacy tokens (gho_/ghp_) are returned unchanged.
 */
export function decryptToken(stored: string): string | null {
  if (!stored) return null;

  // Legacy tokens from before encryption was introduced — return as-is
  if (stored.startsWith("gho_") || stored.startsWith("ghp_") || stored.startsWith("github_pat_")) {
    return stored;
  }

  try {
    const buf = Buffer.from(stored, "base64");
    if (buf.length < 29) return null; // too short to be a valid blob

    const iv        = buf.subarray(0, 12);
    const tag       = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);

    const key = deriveKey();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
  } catch {
    return null;
  }
}
