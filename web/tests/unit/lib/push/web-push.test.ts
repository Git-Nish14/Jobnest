import { createECDH, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as webpush from "web-push";

describe("web-push runtime compatibility", () => {
  it("creates an encrypted, VAPID-authenticated request with a one-hour TTL", () => {
    const receiver = createECDH("prime256v1");
    receiver.generateKeys();
    const vapid = webpush.generateVAPIDKeys();
    const payload = JSON.stringify({ title: "Reminder", body: "Follow up" });

    const request = webpush.generateRequestDetails(
      {
        endpoint: "https://push.example.com/subscription",
        keys: {
          p256dh: receiver.getPublicKey().toString("base64url"),
          auth: randomBytes(16).toString("base64url"),
        },
      },
      payload,
      {
        TTL: 3_600,
        vapidDetails: { subject: "mailto:admin@example.com", ...vapid },
      },
    );

    expect(typeof webpush.sendNotification).toBe("function");
    expect(typeof webpush.setVapidDetails).toBe("function");
    expect(request.method).toBe("POST");
    expect(request.endpoint).toBe("https://push.example.com/subscription");
    expect(request.headers.TTL).toBe(3_600);
    expect(request.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(request.headers.Authorization).toMatch(/^vapid t=.+, k=.+/);
    expect(Buffer.isBuffer(request.body)).toBe(true);
    expect(request.body?.toString()).not.toContain(payload);
  });
});
