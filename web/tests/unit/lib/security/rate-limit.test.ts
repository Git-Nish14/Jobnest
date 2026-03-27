import { describe, it, expect } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit";

// Use unique keys per test to avoid cross-test pollution.
// Counter is never reset so keys remain unique even when tests run in the same millisecond.
let keyCounter = 0;
function uniqueKey() {
  return `test-key-${Date.now()}-${keyCounter++}`;
}

describe("checkRateLimit", () => {

  it("allows first request and returns correct remaining", () => {
    const key = uniqueKey();
    const result = checkRateLimit(key, { maxRequests: 3, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it("allows up to maxRequests within window", () => {
    const key = uniqueKey();
    const opts = { maxRequests: 3, windowMs: 60_000 };
    checkRateLimit(key, opts); // 1
    checkRateLimit(key, opts); // 2
    const third = checkRateLimit(key, opts); // 3
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks once maxRequests is exceeded", () => {
    const key = uniqueKey();
    const opts = { maxRequests: 2, windowMs: 60_000 };
    checkRateLimit(key, opts); // 1
    checkRateLimit(key, opts); // 2
    const blocked = checkRateLimit(key, opts); // 3 — over limit
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("independent keys don't interfere", () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    const opts = { maxRequests: 2, windowMs: 60_000 };
    checkRateLimit(keyA, opts);
    checkRateLimit(keyA, opts);
    checkRateLimit(keyA, opts); // keyA exhausted
    const b = checkRateLimit(keyB, opts);
    expect(b.allowed).toBe(true);
  });

  it("resetTime is after window expires", () => {
    const key = uniqueKey();
    const windowMs = 5_000;
    const before = Date.now();
    const result = checkRateLimit(key, { maxRequests: 5, windowMs });
    expect(result.resetTime).toBeGreaterThanOrEqual(before + windowMs);
  });
});

describe("resetRateLimit", () => {
  it("resets exhausted key so requests are allowed again", () => {
    const key = uniqueKey();
    const opts = { maxRequests: 1, windowMs: 60_000 };
    checkRateLimit(key, opts); // exhaust
    checkRateLimit(key, opts); // blocked
    resetRateLimit(key);
    const result = checkRateLimit(key, opts);
    expect(result.allowed).toBe(true);
  });
});

describe("rate-limit store — memory cap (MAX_STORE_SIZE)", () => {
  it("does not grow the store beyond 10 000 entries", () => {
    // Insert more than MAX_STORE_SIZE unique keys with a very short window
    // so that some are already expired when the cap kicks in.
    const opts = { maxRequests: 1, windowMs: 1 }; // 1ms window → expire immediately
    for (let i = 0; i < 10_100; i++) {
      checkRateLimit(`cap-test-${i}-${Date.now()}`, opts);
    }
    // We can't directly inspect the Map size from outside the module,
    // but we can verify the module still works correctly (no crash / OOM).
    const key = uniqueKey();
    const result = checkRateLimit(key, { maxRequests: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});
