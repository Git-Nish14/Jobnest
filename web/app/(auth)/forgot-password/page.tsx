"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowLeft, Mail, CheckCircle2, KeyRound } from "lucide-react";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

type Step = "email" | "otp" | "reset" | "success";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpVerifyingRef = useRef(false);
  const otpSendingRef = useRef(false);
  const resetPasswordRef = useRef(false);

  const emailForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const resetForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (step === "otp" && otpRefs.current[0]) {
      otpRefs.current[0].focus();
    }
  }, [step]);

  const sendOtp = async (emailToSend: string): Promise<boolean> => {
    if (otpSendingRef.current) return false;
    otpSendingRef.current = true;
    try {
      const response = await fetchWithRetry("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSend, purpose: "password_reset" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send verification code");
        return false;
      }

      setResendCooldown(60);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code. Please try again.");
      return false;
    } finally {
      otpSendingRef.current = false;
    }
  };

  const onSubmitEmail = async (data: ForgotPasswordFormData) => {
    setError(null);
    setEmail(data.email);

    setIsSendingOtp(true);
    const sent = await sendOtp(data.email);
    setIsSendingOtp(false);

    if (sent) {
      setStep("otp");
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    if (digit && index === 5 && newOtp.every((d) => d)) {
      verifyOtp(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split("");
      setOtp(newOtp);
      verifyOtp(pastedData);
    }
  };

  const verifyOtp = async (code: string) => {
    if (otpVerifyingRef.current) return;
    otpVerifyingRef.current = true;
    setError(null);
    setIsVerifying(true);

    try {
      const response = await fetchWithRetry("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, purpose: "password_reset" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid verification code");
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
        return;
      }

      setResetToken(data.reset_token);
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
      otpVerifyingRef.current = false;
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setIsSendingOtp(true);
    await sendOtp(email);
    setIsSendingOtp(false);
    setOtp(["", "", "", "", "", ""]);
    otpRefs.current[0]?.focus();
  };

  const handleBackToEmail = () => {
    setStep("email");
    setOtp(["", "", "", "", "", ""]);
    setError(null);
  };

  const onSubmitReset = async (data: ResetPasswordFormData) => {
    if (resetPasswordRef.current) return;
    resetPasswordRef.current = true;
    setError(null);

    try {
      const response = await fetchWithRetry("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword: data.password, resetToken }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to reset password");
        return;
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password. Please try again.");
    } finally {
      resetPasswordRef.current = false;
    }
  };

  if (step === "success") {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Password Reset Successful</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been updated successfully.
                You can now sign in with your new password.
              </p>
            </div>
            <Link href="/login">
              <Button className="mt-4 w-full">Sign In</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "reset") {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Set new password
          </CardTitle>
          <CardDescription className="text-center">
            Create a strong password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={resetForm.handleSubmit(onSubmitReset)} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...resetForm.register("password")}
                className={resetForm.formState.errors.password ? "border-destructive" : ""}
              />
              {resetForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {resetForm.formState.errors.password.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...resetForm.register("confirmPassword")}
                className={resetForm.formState.errors.confirmPassword ? "border-destructive" : ""}
              />
              {resetForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {resetForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={resetForm.formState.isSubmitting}
            >
              {resetForm.formState.isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reset Password
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step === "otp") {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <button
            onClick={handleBackToEmail}
            className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </button>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Verify your email
          </CardTitle>
          <CardDescription className="text-center">
            We sent a verification code to<br />
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-1.5 sm:gap-2">
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => { otpRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                onPaste={handleOtpPaste}
                disabled={isVerifying}
                className="w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-semibold p-0"
              />
            ))}
          </div>

          <Button
            type="button"
            onClick={() => verifyOtp(otp.join(""))}
            className="w-full"
            disabled={isVerifying || otp.some((d) => !d)}
          >
            {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Didn&apos;t receive the code?{" "}
              <button
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isSendingOtp}
                className="text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingOtp
                  ? "Sending..."
                  : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend code"}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Forgot password?
        </CardTitle>
        <CardDescription className="text-center">
          Enter your email and we&apos;ll send you a verification code
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...emailForm.register("email")}
              className={emailForm.formState.errors.email ? "border-destructive" : ""}
            />
            {emailForm.formState.errors.email && (
              <p className="text-sm text-destructive">
                {emailForm.formState.errors.email.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={emailForm.formState.isSubmitting || isSendingOtp}
          >
            {(emailForm.formState.isSubmitting || isSendingOtp) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isSendingOtp ? "Sending code..." : "Send Verification Code"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
