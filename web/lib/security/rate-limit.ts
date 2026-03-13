// Simple in-memory rate limiter for development
// In production, use Redis or similar

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

const defaultOptions: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 requests per window
};

export function checkRateLimit(
  identifier: string,
  options: Partial<RateLimitOptions> = {}
): { allowed: boolean; remaining: number; resetTime: number } {
  const opts = { ...defaultOptions, ...options };
  const now = Date.now();

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }

  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // Create new entry
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + opts.windowMs,
    });
    return {
      allowed: true,
      remaining: opts.maxRequests - 1,
      resetTime: now + opts.windowMs,
    };
  }

  if (entry.count >= opts.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: opts.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

// Specific rate limiters for different actions
export const authRateLimiter = {
  login: (ip: string) =>
    checkRateLimit(`login:${ip}`, { windowMs: 15 * 60 * 1000, maxRequests: 5 }),
  signup: (ip: string) =>
    checkRateLimit(`signup:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 3 }),
  forgotPassword: (ip: string) =>
    checkRateLimit(`forgot:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 3 }),
  resendVerification: (ip: string) =>
    checkRateLimit(`resend:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 5 }),
};
