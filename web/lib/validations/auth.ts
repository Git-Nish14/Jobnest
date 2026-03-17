import { z } from "zod";

// Email validation with consistent rules
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255, "Email is too long")
  .toLowerCase()
  .trim();

// Password validation with security requirements
export const passwordSchema = z
  .string()
  .min(1, "Password is required")
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

// OTP validation
export const otpSchema = z
  .string()
  .length(6, "Verification code must be 6 digits")
  .regex(/^\d{6}$/, "Verification code must only contain digits");

// Auth purpose validation
export const authPurposeSchema = z.enum(["login", "signup", "password_reset"]);

// Send OTP request schema
export const sendOtpSchema = z.object({
  email: emailSchema,
  purpose: authPurposeSchema.default("login"),
});

// Verify OTP request schema
export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: otpSchema,
  purpose: authPurposeSchema.default("login"),
  password: z.string().optional(),
});

// Reset password request schema
export const resetPasswordSchema = z.object({
  email: emailSchema,
  newPassword: passwordSchema,
  resetToken: z.string().min(1, "Reset token is required"),
});

// Login schema (for forms)
export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").min(6, "Password must be at least 6 characters"),
});

// Signup schema (for forms)
export const signupFormSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Forgot password schema
export const forgotPasswordFormSchema = z.object({
  email: emailSchema,
});

// Reset password form schema
export const resetPasswordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Export types
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type LoginFormData = z.infer<typeof loginFormSchema>;
export type SignupFormData = z.infer<typeof signupFormSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordFormSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordFormSchema>;
