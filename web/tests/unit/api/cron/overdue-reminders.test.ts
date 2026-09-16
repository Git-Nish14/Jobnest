/**
 * Unit tests — GET /api/cron/overdue-reminders
 *
 * Covers:
 *  - 401 when Authorization header is missing
 *  - 401 when secret is wrong
 *  - 200 with no users (empty page)
 *  - 200 skips user with no email
 *  - 200 creates notifications for overdue reminders (opted-out of email)
 *  - 200 creates notifications AND sends email for opted-in user
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({
  sendOverdueReminderEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotifications: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/push/send", () => ({
  sendUserPushNotifications: vi.fn().mockResolvedValue({ sent: 1, removed: 0 }),
}));

import { GET } from "@/app/api/cron/overdue-reminders/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOverdueReminderEmail } from "@/lib/email/nodemailer";
import { createNotifications } from "@/lib/notifications/create";
import { sendUserPushNotifications } from "@/lib/push/send";

const mockAdminClient       = vi.mocked(createAdminClient);
const mockSendEmail         = vi.mocked(sendOverdueReminderEmail);
const mockCreateNotifs      = vi.mocked(createNotifications);
const mockSendPush          = vi.mocked(sendUserPushNotifications);

const CRON_SECRET = "test-cron-secret"; // matches vitest-setup.ts

function makeReq(authHeader: string | null) {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/overdue-reminders", { headers });
}

function makeAdminWithUsers(users: unknown[]) {
  const OVERDUE_REMINDER = {
    id: "rid-1",
    title: "Follow up",
    type: "Follow Up",
    remind_at: new Date(Date.now() - 86_400_000).toISOString(),
    application_id: "app-1",
    job_applications: { company: "Acme", position: "Engineer" },
  };

  return {
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValueOnce({ data: { users }, error: null })
          .mockResolvedValue({ data: { users: [] }, error: null }),
      },
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      lt:     vi.fn().mockReturnThis(),
      lte:    vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockReturnThis(),
      // Resolve to: first call = overdue reminders, second = upcoming interviews
      then: vi.fn().mockImplementation(
        (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [OVERDUE_REMINDER], error: null }).then(resolve)
      ),
    }),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/cron/overdue-reminders — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithUsers([]) as never);
    const res = await GET(makeReq(null));
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithUsers([]) as never);
    const res = await GET(makeReq("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/cron/overdue-reminders — processing", () => {
  it("returns 200 with empty results when no users", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithUsers([]) as never);
    const res = await GET(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.emailsSent).toBe(0);
  });

  it("skips users without email", async () => {
    const users = [{ id: "uid-1", email: undefined, user_metadata: {} }];
    mockAdminClient.mockReturnValue(makeAdminWithUsers(users) as never);
    const res = await GET(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("creates notifications but does NOT email opted-out user", async () => {
    const users = [{
      id: "uid-1",
      email: "user@test.com",
      user_metadata: { notification_prefs: { overdue_reminders: false } },
    }];
    mockAdminClient.mockReturnValue(makeAdminWithUsers(users) as never);
    const res = await GET(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    expect(mockCreateNotifs).toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("creates notifications AND emails opted-in user", async () => {
    const users = [{
      id: "uid-1",
      email: "user@test.com",
      user_metadata: {
        display_name: "Test User",
        notification_prefs: { overdue_reminders: true },
      },
    }];
    mockAdminClient.mockReturnValue(makeAdminWithUsers(users) as never);
    const res = await GET(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    expect(mockCreateNotifs).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      "user@test.com",
      "Test User",
      expect.any(Array)
    );
    const body = await res.json();
    expect(body.emailsSent).toBe(1);
  });
});

describe("GET /api/cron/overdue-reminders — push notifications", () => {
  it("sends push notification for overdue reminders", async () => {
    const users = [{
      id: "uid-push",
      email: "push@test.com",
      user_metadata: {},
    }];
    mockAdminClient.mockReturnValue(makeAdminWithUsers(users) as never);
    const res = await GET(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);

    expect(mockSendPush).toHaveBeenCalledWith(
      "uid-push",
      expect.objectContaining({
        title: expect.any(String),
        body: expect.any(String),
        url: "/reminders",
        tag: "overdue-reminders",
      })
    );
    const body = await res.json();
    expect(body.pushSent).toBe(1);
  });

  it("push body title is truncated to 100 chars when reminder title is very long", async () => {
    const longTitle = "A".repeat(200);
    const OVERDUE_LONG = {
      id: "rid-long",
      title: longTitle,
      type: "Follow Up",
      remind_at: new Date(Date.now() - 86_400_000).toISOString(),
      application_id: "app-2",
      job_applications: { company: "Corp", position: "Dev" },
    };
    const admin = {
      auth: {
        admin: {
          listUsers: vi.fn()
            .mockResolvedValueOnce({ data: { users: [{ id: "uid-long", email: "long@test.com", user_metadata: {} }] }, error: null })
            .mockResolvedValue({ data: { users: [] }, error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        lt:     vi.fn().mockReturnThis(),
        lte:    vi.fn().mockReturnThis(),
        gte:    vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(),
        limit:  vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation(
          (resolve: (v: unknown) => void) =>
            Promise.resolve({ data: [OVERDUE_LONG], error: null }).then(resolve)
        ),
      }),
    };
    mockAdminClient.mockReturnValue(admin as never);

    await GET(makeReq(`Bearer ${CRON_SECRET}`));

    const pushCall = mockSendPush.mock.calls[0];
    const payload = pushCall[1];
    // Body uses the truncated title (≤ 100 chars)
    expect(payload.body.length).toBeLessThanOrEqual(100);
  });

  it("push error does not abort email sending for other users", async () => {
    mockSendPush.mockRejectedValueOnce(new Error("push service unreachable"));
    const users = [{
      id: "uid-pusherr",
      email: "err@test.com",
      user_metadata: { notification_prefs: { overdue_reminders: true } },
    }];
    mockAdminClient.mockReturnValue(makeAdminWithUsers(users) as never);
    const res = await GET(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    // Error is captured in results.errors, not thrown
    const body = await res.json();
    expect(body.errors.length).toBeGreaterThan(0);
    // Email was still attempted
    expect(mockSendEmail).toHaveBeenCalled();
  });
});
