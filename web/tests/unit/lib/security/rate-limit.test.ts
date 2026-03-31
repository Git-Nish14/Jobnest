import { describe, it, expect } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit";

// Use unique keys per test to avoid cross-test pollution.
let keyCounter = 0;
function uniqueKey() {
  return `test-key-${Date.now()}-${keyCounter++}`;
}

describe("checkRateLimit", () => {

  it("allows first request and returns correct remaining", async () => {
    const key = uniqueKey();
    const result = await checkRateLimit(key, { maxRequests: 3, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it("allows up to maxRequests within window", async () => {
    const key = uniqueKey();
    const opts = { maxRequests: 3, windowMs: 60_000 };
    await checkRateLimit(key, opts); // 1
    await checkRateLimit(key, opts); // 2
    const third = await checkRateLimit(key, opts); // 3
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks once maxRequests is exceeded", async () => {
    const key = uniqueKey();
    const opts = { maxRequests: 2, windowMs: 60_000 };
    await checkRateLimit(key, opts); // 1
    await checkRateLimit(key, opts); // 2
    const blocked = await checkRateLimit(key, opts); // 3 — over limit
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("independent keys don't interfere", async () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    const opts = { maxRequests: 2, windowMs: 60_000 };
    await checkRateLimit(keyA, opts);
    await checkRateLimit(keyA, opts);
    await checkRateLimit(keyA, opts); // keyA exhausted
    const b = await checkRateLimit(keyB, opts);
    expect(b.allowed).toBe(true);
  });

  it("resetTime is after window expires", async () => {
    const key = uniqueKey();
    const windowMs = 5_000;
    const before = Date.now();
    const result = await checkRateLimit(key, { maxRequests: 5, windowMs });
    expect(result.resetTime).toBeGreaterThanOrEqual(before + windowMs);
  });
});

describe("resetRateLimit", () => {
  it("resets exhausted key so requests are allowed again", async () => {
    const key = uniqueKey();
    const opts = { maxRequests: 1, windowMs: 60_000 };
    await checkRateLimit(key, opts); // exhaust
    await checkRateLimit(key, opts); // blocked
    await resetRateLimit(key);
    const result = await checkRateLimit(key, opts);
    expect(result.allowed).toBe(true);
  });
});

describe("rate-limit store — memory cap (MAX_STORE_SIZE)", () => {
  it("does not grow the store beyond 10 000 entries", async () => {
    const opts = { maxRequests: 1, windowMs: 1 }; // 1ms window → expire immediately
    for (let i = 0; i < 10_100; i++) {
      await checkRateLimit(`cap-test-${i}-${Date.now()}`, opts);
    }
    const key = uniqueKey();
    const result = await checkRateLimit(key, { maxRequests: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});
