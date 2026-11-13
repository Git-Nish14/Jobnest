import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/email/ses", () => ({
  checkEmailConfig: vi.fn(() => ({ ok: true })),
  getContactEmail: () => "me@nishpatel.dev",
  sendEmail: vi.fn().mockResolvedValue({ messageId: "test-id" }),
}));

import { POST } from "@/app/api/contact/route";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { checkEmailConfig, sendEmail } from "@/lib/email/ses";

function request() {
  return new NextRequest("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test User", email: "user@example.com", subject: "Help with Jobnest", message: "Please help with my account." }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 4, resetTime: Date.now() + 3600000 });
  vi.mocked(checkEmailConfig).mockReturnValue({ ok: true });
  vi.mocked(sendEmail).mockResolvedValue({ messageId: "test-id" });
});

describe("contact email delivery", () => {
  it("sends the submission to the contact inbox and a confirmation to the user", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({ fromName: "Jobnest Contact", to: "me@nishpatel.dev", replyTo: "user@example.com" }));
    expect(sendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: "user@example.com", subject: "We received your message - Jobnest" }));
  });

  it("returns 503 when SES rejects delivery", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("MessageRejected"));
    expect((await POST(request())).status).toBe(503);
    expect(sendEmail).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("stops before sending when configuration is invalid", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(checkEmailConfig).mockReturnValue({ ok: false, error: "AWS SES credentials are incomplete" });
    expect((await POST(request())).status).toBe(503);
    expect(sendEmail).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
