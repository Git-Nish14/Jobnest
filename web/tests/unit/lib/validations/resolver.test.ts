import { describe, expect, it } from "vitest";
import { zodResolver } from "@hookform/resolvers/zod";
import { applicationSchema } from "@/lib/validations/application";
import { loginFormSchema, signupFormSchema } from "@/lib/validations/auth";

const options = { fields: {}, shouldUseNativeValidation: false };

describe("form resolver compatibility", () => {
  it("returns normalized login values to React Hook Form", async () => {
    const result = await zodResolver(loginFormSchema)(
      { email: "USER@EXAMPLE.COM", password: "SecurePass1" },
      undefined,
      options,
    );

    expect(result).toEqual({
      values: { email: "user@example.com", password: "SecurePass1" },
      errors: {},
    });
  });

  it("maps validation failures to field errors without throwing", async () => {
    const result = await zodResolver(loginFormSchema)(
      { email: "invalid", password: "" },
      undefined,
      { ...options, criteriaMode: "all" },
    );

    expect(result.values).toEqual({});
    expect(result.errors).toMatchObject({
      email: { message: "Please enter a valid email address" },
      password: {
        message: "Password is required",
        types: { too_small: ["Password is required", "Password must be at least 6 characters"] },
      },
    });
  });

  it("preserves the signup password confirmation error path", async () => {
    const result = await zodResolver(signupFormSchema)(
      {
        email: "user@example.com",
        password: "SecurePass1",
        confirmPassword: "DifferentPass1",
        ageConfirmed: true,
        termsAccepted: true,
      },
      undefined,
      options,
    );

    expect(result.values).toEqual({});
    expect(result.errors).toMatchObject({
      confirmPassword: { message: "Passwords don't match", type: "custom" },
    });
  });

  it("applies application defaults and URL transforms before submission", async () => {
    const result = await zodResolver(applicationSchema)(
      {
        company: " Acme ",
        position: " Engineer ",
        status: "Applied",
        applied_date: "2026-10-26",
        job_url: " https://example.com/jobs\t ",
      },
      undefined,
      options,
    );

    expect(result.errors).toEqual({});
    expect(result.values).toMatchObject({
      company: "Acme",
      position: "Engineer",
      job_url: "https://example.com/jobs",
      requires_sponsorship: false,
    });
  });

  it("keeps unsafe application URLs blocked at the form boundary", async () => {
    const result = await zodResolver(applicationSchema)(
      {
        company: "Acme",
        position: "Engineer",
        status: "Applied",
        applied_date: "2026-10-26",
        job_url: "javascript\t:alert(1)",
      },
      undefined,
      options,
    );

    expect(result.values).toEqual({});
    expect(result.errors).toMatchObject({
      job_url: { message: "Please enter a valid URL (must start with https://)" },
    });
  });
});
