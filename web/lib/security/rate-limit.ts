// Simple in-memory rate limiter.
// NOTE: resets on cold-start and is not shared across serverless instances.
// For production at scale replace with Upstash Redis or Vercel KV.

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Hard cap: prevent unbounded memory growth if an attacker generates a huge
// number of unique keys (e.g. rotating source IPs). When the cap is reached,
// the oldest expired entries are evicted first; if none exist, the oldest
// entry regardless of expiry is removed (LRU-lite).
const MAX_STORE_SIZE = 10_000;
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

  // Periodic cleanup of expired entries (1% chance per call)
  if (Math.random() < 0.01) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }

  // Hard cap: evict if store exceeds MAX_STORE_SIZE
  if (rateLimitStore.size >= MAX_STORE_SIZE) {
    // Prefer removing an expired entry; fall back to the oldest (first) entry
    let evictKey: string | undefined;
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) { evictKey = key; break; }
      if (!evictKey) evictKey = key; // remember first as fallback
    }
    if (evictKey) rateLimitStore.delete(evictKey);
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
