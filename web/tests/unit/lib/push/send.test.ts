/**
 * Unit tests — sendUserPushNotifications
 *
 * Covers:
 *  - Skips silently when VAPID keys are not configured
 *  - Returns { sent:0 } when user has no subscriptions
 *  - Sends to all registered subscriptions and returns correct sent count
 *  - Auto-removes expired subscriptions (push service returns 410)
 *  - Does NOT remove subscriptions on generic (non-410) send errors
 *  - Handles mixed results: some sent, some expired, some generic error
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock web-push before importing the module under test
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import webpush from "web-push";
import { sendUserPushNotifications } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

const mockWebpush = vi.mocked(webpush);
const mockAdmin   = vi.mocked(createAdminClient);

const USER_ID = "user-push-send-test";

const SUB_A = { id: "sub-a", endpoint: "https://push.example.com/a", p256dh: "keyA", auth: "authA" };
const SUB_B = { id: "sub-b", endpoint: "https://push.example.com/b", p256dh: "keyB", auth: "authB" };
const SUB_C = { id: "sub-c", endpoint: "https://push.example.com/c", p256dh: "keyC", auth: "authC" };

const PAYLOAD = { title: "Overdue reminder", body: "Follow up with Acme", url: "/reminders", tag: "overdue-reminders" };

function makeAdminWith(subs: unknown[], deleteError: unknown = null) {
  const deleteChain = {
    in: vi.fn().mockResolvedValue({ error: deleteError }),
  };
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockResolvedValue({ data: subs, error: null }),
      delete: vi.fn().mockReturnValue(deleteChain),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY  = "fake-pub-key";
  process.env.VAPID_PRIVATE_KEY = "fake-priv-key";
  process.env.VAPID_EMAIL       = "admin@jobnest.app";
});

afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_EMAIL;
});

// ── VAPID not configured ──────────────────────────────────────────────────────

describe("sendUserPushNotifications — no VAPID keys", () => {
  it("returns { sent:0, removed:0 } and skips without calling webpush", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const result = await sendUserPushNotifications(USER_ID, PAYLOAD);

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(mockWebpush.sendNotification).not.toHaveBeenCalled();
  });
});

// ── No subscriptions ─────────────────────────────────────────────────────────

describe("sendUserPushNotifications — no subscriptions", () => {
  it("returns { sent:0, removed:0 } when user has no subscriptions", async () => {
    mockAdmin.mockReturnValue(makeAdminWith([]) as never);

    const result = await sendUserPushNotifications(USER_ID, PAYLOAD);

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(mockWebpush.sendNotification).not.toHaveBeenCalled();
  });
});

// ── All successful ────────────────────────────────────────────────────────────

describe("sendUserPushNotifications — all succeed", () => {
  it("sends to every subscription and returns correct sent count", async () => {
    mockAdmin.mockReturnValue(makeAdminWith([SUB_A, SUB_B]) as never);
    mockWebpush.sendNotification.mockResolvedValue({} as never);

    const result = await sendUserPushNotifications(USER_ID, PAYLOAD);

    expect(result.sent).toBe(2);
    expect(result.removed).toBe(0);
    expect(mockWebpush.sendNotification).toHaveBeenCalledTimes(2);

    // Verify TTL is 3600 (not 86400 — stale notification fix)
    const [, , opts] = mockWebpush.sendNotification.mock.calls[0];
    expect((opts as { TTL: number }).TTL).toBe(3_600);
  });
});

// ── Expired subscriptions (410/404) ──────────────────────────────────────────

describe("sendUserPushNotifications — expired subscriptions", () => {
  it("removes 410-expired subscription and counts correctly", async () => {
    mockAdmin.mockReturnValue(makeAdminWith([SUB_A, SUB_B]) as never);

    // SUB_A succeeds, SUB_B returns 410 (gone)
    mockWebpush.sendNotification
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }));

    const result = await sendUserPushNotifications(USER_ID, PAYLOAD);

    expect(result.sent).toBe(1);
    expect(result.removed).toBe(1);
  });

  it("removes 404-expired subscription", async () => {
    mockAdmin.mockReturnValue(makeAdminWith([SUB_A]) as never);
    mockWebpush.sendNotification.mockRejectedValue(
      Object.assign(new Error("Not Found"), { statusCode: 404 })
    );

    const result = await sendUserPushNotifications(USER_ID, PAYLOAD);

    expect(result.removed).toBe(1);
    expect(result.sent).toBe(0);
  });
});

// ── Generic send error ────────────────────────────────────────────────────────

describe("sendUserPushNotifications — generic errors", () => {
  it("does NOT remove subscription on generic error (non-410)", async () => {
    mockAdmin.mockReturnValue(makeAdminWith([SUB_A]) as never);
    mockWebpush.sendNotification.mockRejectedValue(
      Object.assign(new Error("Server error"), { statusCode: 500 })
    );

    const result = await sendUserPushNotifications(USER_ID, PAYLOAD);

    expect(result.sent).toBe(0);
    expect(result.removed).toBe(0);
  });

  it("handles mixed: one sent, one expired, one generic error", async () => {
    mockAdmin.mockReturnValue(makeAdminWith([SUB_A, SUB_B, SUB_C]) as never);

    mockWebpush.sendNotification
      .mockResolvedValueOnce({} as never)                                                   // A: sent
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }))         // B: expired
      .mockRejectedValueOnce(Object.assign(new Error("Server error"), { statusCode: 500 })); // C: generic

    const result = await sendUserPushNotifications(USER_ID, PAYLOAD);

    expect(result.sent).toBe(1);
    expect(result.removed).toBe(1);
  });
});
