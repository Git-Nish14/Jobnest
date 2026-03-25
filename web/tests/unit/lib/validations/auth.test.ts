import { describe, it, expect } from "vitest";
import {
  emailSchema,
  passwordSchema,
  otpSchema,
  authPurposeSchema,
  sendOtpSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

describe("emailSchema", () => {
  it("accepts valid email", () => {
    expect(emailSchema.parse("Test@Example.COM")).toBe("test@example.com"); // lowercased
  });

  it("rejects invalid email", () => {
    expect(() => emailSchema.parse("notanemail")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => emailSchema.parse("")).toThrow();
  });

  it("rejects email over 255 chars", () => {
    const long = "a".repeat(250) + "@b.com";
    expect(() => emailSchema.parse(long)).toThrow();
  });

  it("lowercases email", () => {
    // Zod 4 validates format before transforms; trimming doesn't affect the valid email body
    const result = emailSchema.parse("USER@EXAMPLE.COM");
    expect(result).toBe("user@example.com");
  });
});

describe("passwordSchema", () => {
  it("accepts strong password", () => {
    expect(passwordSchema.parse("SecurePass1")).toBe("SecurePass1");
  });

  it("rejects password under 8 chars", () => {
    expect(() => passwordSchema.parse("Abc1")).toThrow();
  });

  it("rejects password without uppercase", () => {
    expect(() => passwordSchema.parse("lowercase1")).toThrow();
  });

  it("rejects password without lowercase", () => {
    expect(() => passwordSchema.parse("UPPERCASE1")).toThrow();
  });

  it("rejects password without number", () => {
    expect(() => passwordSchema.parse("NoNumbers!")).toThrow();
  });

  it("rejects password over 128 chars", () => {
    expect(() => passwordSchema.parse("A1" + "a".repeat(127))).toThrow();
  });
});

describe("otpSchema", () => {
  it("accepts 6-digit code", () => {
    expect(otpSchema.parse("123456")).toBe("123456");
  });

  it("rejects 5-digit code", () => {
    expect(() => otpSchema.parse("12345")).toThrow();
  });

  it("rejects non-digit characters", () => {
    expect(() => otpSchema.parse("12345a")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => otpSchema.parse("")).toThrow();
  });
});

describe("authPurposeSchema", () => {
  const validPurposes = ["login", "signup", "password_reset", "change_password", "delete_account"] as const;

  for (const p of validPurposes) {
    it(`accepts '${p}'`, () => {
      expect(authPurposeSchema.parse(p)).toBe(p);
    });
  }

  it("rejects unknown purpose", () => {
    expect(() => authPurposeSchema.parse("hack")).toThrow();
  });
});

describe("sendOtpSchema", () => {
  it("accepts valid email and purpose", () => {
    const result = sendOtpSchema.parse({ email: "a@b.com", purpose: "login" });
    expect(result.email).toBe("a@b.com");
    expect(result.purpose).toBe("login");
  });

  it("defaults purpose to login", () => {
    const result = sendOtpSchema.parse({ email: "a@b.com" });
    expect(result.purpose).toBe("login");
  });

  it("rejects invalid email", () => {
    expect(() => sendOtpSchema.parse({ email: "bad", purpose: "login" })).toThrow();
  });
});

describe("verifyOtpSchema", () => {
  it("accepts full valid input", () => {
    const result = verifyOtpSchema.parse({
      email: "a@b.com",
      code: "123456",
      purpose: "login",
      password: "Secret1",
      rememberMe: true,
    });
    expect(result.code).toBe("123456");
  });

  it("defaults rememberMe to true", () => {
    const result = verifyOtpSchema.parse({ email: "a@b.com", code: "123456", purpose: "signup" });
    expect(result.rememberMe).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid reset payload", () => {
    const result = resetPasswordSchema.parse({
      email: "a@b.com",
      newPassword: "NewPass1",
      resetToken: "abc-token",
    });
    expect(result.resetToken).toBe("abc-token");
  });

  it("rejects weak newPassword", () => {
    expect(() =>
      resetPasswordSchema.parse({ email: "a@b.com", newPassword: "weak", resetToken: "x" })
    ).toThrow();
  });
});
