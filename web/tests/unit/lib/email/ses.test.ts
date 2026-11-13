import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), config: vi.fn() }));
vi.mock("@aws-sdk/client-sesv2", async importOriginal => ({
  ...await importOriginal<typeof import("@aws-sdk/client-sesv2")>(),
  SESv2Client: class {
    config = { region: async () => "us-east-1" };
    send = mocks.send;
    constructor(config: unknown) { mocks.config(config); }
  },
}));

import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { checkEmailConfig, getContactEmail, sendEmail } from "@/lib/email/ses";
import { sendOTPEmail } from "@/lib/email/nodemailer";

beforeEach(() => {
  mocks.send.mockReset().mockResolvedValue({ MessageId: "local-message-id" });
  mocks.config.mockClear();
  for (const key of ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_SES_SESSION_TOKEN", "AWS_SES_CONFIGURATION_SET"]) {
    vi.stubEnv(key, undefined);
  }
  vi.stubEnv("AWS_SES_REGION", "us-east-1");
  vi.stubEnv("AWS_SES_ACCESS_KEY_ID", "test-access-key");
  vi.stubEnv("AWS_SES_SECRET_ACCESS_KEY", "test-secret-key");
  vi.stubEnv("SES_FROM_EMAIL", "me@nishpatel.dev");
  vi.stubEnv("CONTACT_EMAIL", "me@nishpatel.dev");
});
afterEach(() => vi.unstubAllEnvs());

function sentMessage() {
  const command = mocks.send.mock.calls[0][0] as SendEmailCommand;
  expect(command).toBeInstanceOf(SendEmailCommand);
  return { input: command.input, mime: Buffer.from(command.input.Content!.Raw!.Data!).toString("utf8") };
}

describe("SES transport with real Nodemailer MIME composition", () => {
  it("sends OTP mail from the configured sender with contact replies", async () => {
    expect(await sendOTPEmail("user@example.com", "123456", "signup")).toEqual({ success: true });
    const { input, mime } = sentMessage();
    expect(input.Destination?.ToAddresses).toEqual(["user@example.com"]);
    expect(mime).toContain("From: Jobnest <me@nishpatel.dev>");
    expect(mime).toContain("Reply-To: me@nishpatel.dev");
    expect(mime).toContain("123456 is your Jobnest verification code");
    expect(mime).toContain("verify your email address");
  });

  it("preserves contact reply-to and passes the optional configuration set", async () => {
    vi.stubEnv("AWS_SES_CONFIGURATION_SET", "jobnest-events");
    await sendEmail({ fromName: "Jobnest Contact", to: getContactEmail(), replyTo: "user@example.com", subject: "Contact", text: "Hello" });
    const { input, mime } = sentMessage();
    expect(input.ConfigurationSetName).toBe("jobnest-events");
    expect(input.Destination?.ToAddresses).toEqual(["me@nishpatel.dev"]);
    expect(mime).toContain("From: Jobnest Contact <me@nishpatel.dev>");
    expect(mime).toContain("Reply-To: user@example.com");
  });

  it("supports standard AWS credentials with a session token", async () => {
    vi.stubEnv("AWS_SES_REGION", undefined);
    vi.stubEnv("AWS_SES_ACCESS_KEY_ID", undefined);
    vi.stubEnv("AWS_SES_SECRET_ACCESS_KEY", undefined);
    vi.stubEnv("AWS_REGION", "eu-west-1");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "standard-key");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "standard-secret");
    vi.stubEnv("AWS_SESSION_TOKEN", "session-token");
    await sendEmail({ to: "user@example.com", subject: "Hello", text: "Hello" });
    expect(mocks.config).toHaveBeenCalledWith({ region: "eu-west-1", credentials: { accessKeyId: "standard-key", secretAccessKey: "standard-secret", sessionToken: "session-token" } });
  });

  it("uses the SDK credential chain for IAM roles", async () => {
    vi.stubEnv("AWS_SES_ACCESS_KEY_ID", undefined);
    vi.stubEnv("AWS_SES_SECRET_ACCESS_KEY", undefined);
    await sendEmail({ to: "user@example.com", subject: "Hello", text: "Hello" });
    expect(mocks.config).toHaveBeenCalledWith({ region: "us-east-1" });
  });

  it("reports incomplete credentials without contacting AWS", () => {
    vi.stubEnv("AWS_SES_SECRET_ACCESS_KEY", undefined);
    expect(checkEmailConfig()).toEqual({ ok: false, error: "AWS SES credentials are incomplete" });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["SES_FROM_EMAIL", "CONTACT_EMAIL"])("rejects unsafe %s addresses", key => {
    vi.stubEnv(key, "user@example.com\r\nBcc: other@example.com");
    expect(checkEmailConfig().ok).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("returns an email failure when AWS rejects an OTP message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockRejectedValueOnce(new Error("Email address is not verified"));
    expect(await sendOTPEmail("user@example.com", "123456")).toEqual({ success: false, error: "Email address is not verified" });
    vi.restoreAllMocks();
  });
});
