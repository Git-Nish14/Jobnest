/**
 * Security utilities for input sanitization
 */

// HTML entities to escape
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize user input for safe HTML insertion
 * Removes potentially dangerous characters and escapes HTML
 */
export function sanitizeForHtml(str: string): string {
  if (typeof str !== "string") return "";

  // First, escape HTML entities
  let sanitized = escapeHtml(str);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Convert newlines to <br> for display (already escaped)
  sanitized = sanitized.replace(/\n/g, "<br>");

  return sanitized;
}

/**
 * Sanitize user input for email body (preserves whitespace)
 */
export function sanitizeForEmail(str: string): string {
  if (typeof str !== "string") return "";

  // Escape HTML but preserve whitespace
  let sanitized = escapeHtml(str);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  return sanitized;
}

/**
 * Strip HTML tags from a string
 */
export function stripHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "");
}

/**
 * Validate and sanitize a URL
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== "string") return null;

  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    // Prevent javascript: URLs that might slip through
    if (parsed.href.toLowerCase().includes("javascript:")) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Sanitize a filename
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== "string") return "";

  // Remove path separators and dangerous characters
  return filename
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\.\./g, "")
    .replace(/^\./, "")
    .trim()
    .slice(0, 255);
}

/**
 * Check if string contains potentially malicious content
 */
export function containsMaliciousContent(str: string): boolean {
  if (typeof str !== "string") return false;

  const patterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick=
    /data:/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /vbscript:/gi,
  ];

  return patterns.some((pattern) => pattern.test(str));
}
