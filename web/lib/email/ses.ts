import nodemailer, { type SendMailOptions } from "nodemailer";
import { SendEmailCommand, SESv2Client, type SESv2ClientConfig } from "@aws-sdk/client-sesv2";

const DEFAULT_EMAIL = "me@nishpatel.dev";

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function emailAddress(value: string, label: string): string {
  if (!/^[^\s<>@,;"\\]+@[^\s<>@,;"\\]+\.[^\s<>@,;"\\]+$/.test(value)) {
    throw new Error(`Invalid ${label} email address`);
  }
  return value;
}

export function getSenderEmail(): string {
  return emailAddress(env("SES_FROM_EMAIL") ?? DEFAULT_EMAIL, "sender");
}

export function getContactEmail(): string {
  return emailAddress(env("CONTACT_EMAIL") ?? DEFAULT_EMAIL, "contact");
}

function getSesConfig(): SESv2ClientConfig {
  const region = env("AWS_SES_REGION") ?? env("AWS_REGION") ?? "us-east-1";
  if (!/^[a-z0-9-]+$/.test(region)) throw new Error("Invalid AWS SES region");

  const accessKeyId = env("AWS_SES_ACCESS_KEY_ID") ?? env("AWS_ACCESS_KEY_ID");
  const secretAccessKey = env("AWS_SES_SECRET_ACCESS_KEY") ?? env("AWS_SECRET_ACCESS_KEY");
  const sessionToken = env("AWS_SES_SESSION_TOKEN") ?? env("AWS_SESSION_TOKEN");
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("AWS SES credentials are incomplete");
  }

  return {
    region,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } }
      : {}), // Otherwise use the SDK's default credential chain (for example, an IAM role).
  };
}

/** Validates local configuration; does not check AWS credentials or sender verification. */
export function checkEmailConfig(): { ok: true } | { ok: false; error: string } {
  try {
    getSesConfig();
    getSenderEmail();
    getContactEmail();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid email configuration" };
  }
}

type EmailOptions = Omit<SendMailOptions, "from" | "sender" | "ses" | "disableFileAccess" | "disableUrlAccess"> & {
  fromName?: string;
};

export async function sendEmail({ fromName = "Jobnest", ...options }: EmailOptions) {
  const transporter = nodemailer.createTransport({
    SES: { sesClient: new SESv2Client(getSesConfig()), SendEmailCommand },
  });
  const configurationSet = env("AWS_SES_CONFIGURATION_SET");
  return transporter.sendMail({
    ...options,
    from: { name: fromName, address: getSenderEmail() },
    replyTo: options.replyTo ?? getContactEmail(),
    disableFileAccess: true,
    disableUrlAccess: true,
    ...(configurationSet ? { ses: { ConfigurationSetName: configurationSet } } : {}),
  });
}
