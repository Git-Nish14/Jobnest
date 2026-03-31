/**
 * Rate limiter — Redis-backed when Upstash env vars are set, in-memory otherwise.
 *
 * In-memory resets on every cold start (every serverless invocation that
 * doesn't share the same process). Redis persists across cold starts so limits
 * are reliable in production even on multi-instance deployments.
 *
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in env to enable Redis.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  windowMs: number;   // Time window in milliseconds
  maxRequests: number; // Max requests allowed per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix ms
}

const DEFAULT: RateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
};

// ── In-memory fallback ────────────────────────────────────────────────────────

interface MemEntry {
  count: number;
  resetTime: number;
}

const MAX_STORE_SIZE = 10_000;
const memStore = new Map<string, MemEntry>();

function memCheckRateLimit(
  key: string,
  opts: RateLimitOptions
): RateLimitResult {
  const now = Date.now();

  // Probabilistic GC — 1% chance per call
  if (Math.random() < 0.01) {
    for (const [k, e] of memStore.entries()) {
      if (now > e.resetTime) memStore.delete(k);
    }
  }

  // Hard cap — evict expired first, then oldest
  if (memStore.size >= MAX_STORE_SIZE) {
    let evict: string | undefined;
    for (const [k, e] of memStore.entries()) {
      if (now > e.resetTime) { evict = k; break; }
      if (!evict) evict = k;
    }
    if (evict) memStore.delete(evict);
  }

  const entry = memStore.get(key);

  if (!entry || now > entry.resetTime) {
    const resetTime = now + opts.windowMs;
    memStore.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: opts.maxRequests - 1, resetTime };
  }

  if (entry.count >= opts.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: opts.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

function memResetRateLimit(key: string): void {
  memStore.delete(key);
}

// ── Redis backend (Upstash REST API — no persistent TCP connection needed) ────

function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function redisCommand(args: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  const res = await fetch(`${url}/${args.map(encodeURIComponent).join("/")}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    // Don't cache Redis responses
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Redis command failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return json.result;
}

/**
 * Atomic sliding-window counter using Redis INCR + PEXPIRE.
 * Uses a fixed window (same as the in-memory impl) for simplicity.
 */
async function redisCheckRateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const windowSec = Math.ceil(opts.windowMs / 1000);

  // INCR — creates the key with value 1 if it doesn't exist
  const count = (await redisCommand(["INCR", redisKey])) as number;

  if (count === 1) {
    // First request in this window — set the TTL
    await redisCommand(["EXPIRE", redisKey, windowSec]);
  }

  // Get the TTL to calculate the reset time
  const ttlSec = (await redisCommand(["TTL", redisKey])) as number;
  const resetTime = Date.now() + Math.max(ttlSec, 0) * 1000;

  if (count > opts.maxRequests) {
    return { allowed: false, remaining: 0, resetTime };
  }

  return {
    allowed: true,
    remaining: Math.max(0, opts.maxRequests - count),
    resetTime,
  };
}

async function redisResetRateLimit(key: string): Promise<void> {
  await redisCommand(["DEL", `rl:${key}`]);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether the given identifier has exceeded its rate limit.
 *
 * @param identifier  A unique key, e.g. `send-otp:user@example.com`
 * @param options     Override default window / max-requests
 */
export async function checkRateLimit(
  identifier: string,
  options: Partial<RateLimitOptions> = {}
): Promise<RateLimitResult> {
  const opts = { ...DEFAULT, ...options };

  if (isRedisConfigured()) {
    try {
      return await redisCheckRateLimit(identifier, opts);
    } catch (err) {
      // Redis unavailable — fall back to in-memory so the app stays up
      console.warn("[rate-limit] Redis error, falling back to in-memory:", err);
    }
  }

  return memCheckRateLimit(identifier, opts);
}

/**
 * Remove a rate-limit entry (e.g. after a successful action).
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  if (isRedisConfigured()) {
    try {
      await redisResetRateLimit(identifier);
      return;
    } catch (err) {
      console.warn("[rate-limit] Redis error on reset, falling back:", err);
    }
  }
  memResetRateLimit(identifier);
}
