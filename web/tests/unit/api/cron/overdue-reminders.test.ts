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

import { GET } from "@/app/api/cron/overdue-reminders/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOverdueReminderEmail } from "@/lib/email/nodemailer";
import { createNotifications } from "@/lib/notifications/create";

const mockAdminClient       = vi.mocked(createAdminClient);
const mockSendEmail         = vi.mocked(sendOverdueReminderEmail);
const mockCreateNotifs      = vi.mocked(createNotifications);

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
