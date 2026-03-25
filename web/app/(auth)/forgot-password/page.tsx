"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowLeft, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";

// ── Schemas ───────────────────────────────────────────────────────────────────
const emailSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
});

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type EmailData = z.infer<typeof emailSchema>;
type ResetData = z.infer<typeof resetSchema>;
type Step = "email" | "otp" | "reset" | "success";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpVerifyingRef = useRef(false);
  const otpSendingRef = useRef(false);
  const resetRef = useRef(false);

  const emailForm = useForm<EmailData>({ resolver: zodResolver(emailSchema) });
  const resetForm = useForm<ResetData>({ resolver: zodResolver(resetSchema) });

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (step === "otp") otpRefs.current[0]?.focus();
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
      if (!response.ok) { setError(data.error || "Failed to send verification code"); return false; }
      setResendCooldown(60);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code. Please try again.");
      return false;
    } finally {
      otpSendingRef.current = false;
    }
  };

  const onSubmitEmail = async (data: EmailData) => {
    setError(null);
    setEmail(data.email);
    setIsSendingOtp(true);
    const sent = await sendOtp(data.email);
    setIsSendingOtp(false);
    if (sent) setStep("otp");
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    if (digit && index === 5 && newOtp.every((d) => d)) verifyOtp(newOtp.join(""));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split("")); verifyOtp(pasted); }
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

  const onSubmitReset = async (data: ResetData) => {
    if (resetRef.current) return;
    resetRef.current = true;
    setError(null);
    try {
      const response = await fetchWithRetry("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword: data.password, resetToken }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Failed to reset password"); return; }
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password. Please try again.");
    } finally {
      resetRef.current = false;
    }
  };

  // ── Shell ─────────────────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="atelier-glow-top" />
      <div className="atelier-glow-bottom" />
      <div className="atelier-grain" />
      <div className="w-full max-w-110 z-10">{children}</div>
    </main>
  );

  const Logo = () => (
    <div className="flex flex-col items-center mb-10">
      <div className="mb-5">
        <Image src="/new_logo_1.png" alt="Jobnest" width={52} height={52} priority />
      </div>
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <Shell>
        <div className="text-center">
          <div className="atelier-success-icon">
            <CheckCircle2 className="w-7 h-7 text-emerald-700" aria-hidden="true" />
          </div>
          <h1 className="atelier-headline text-4xl mb-3">Password reset!</h1>
          <p className="atelier-subtext mb-8">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Link href="/login" className="atelier-btn-primary block no-underline">
            Back to Sign In
          </Link>
        </div>
      </Shell>
    );
  }

  // ── Reset step — set new password ─────────────────────────────────────────
  if (step === "reset") {
    return (
      <Shell>
        <Logo />
        <div className="text-center mb-8">
          <h1 className="atelier-headline text-4xl mb-2">Set new password</h1>
          <p className="atelier-subtext">Create a strong password for <strong>{email}</strong></p>
        </div>

        <div className="atelier-card">
          {error && <p className="atelier-error" role="alert">{error}</p>}

          <form onSubmit={resetForm.handleSubmit(onSubmitReset)} className="space-y-5" noValidate>
            <div>
              <label htmlFor="new-password" className="atelier-label">New password</label>
              <div className="atelier-input-wrap">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...resetForm.register("password")}
                  className={`atelier-input${resetForm.formState.errors.password ? " atelier-input-error-state" : ""}`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="atelier-eye-btn"
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                    : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
              {resetForm.formState.errors.password && (
                <p className="atelier-field-error" role="alert">
                  {resetForm.formState.errors.password.message}
                </p>
              )}
              <p className="atelier-strength-hint mt-1">
                8+ characters, uppercase, lowercase & number
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="atelier-label">Confirm new password</label>
              <div className="atelier-input-wrap">
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...resetForm.register("confirmPassword")}
                  className={`atelier-input${resetForm.formState.errors.confirmPassword ? " atelier-input-error-state" : ""}`}
                />
                <button
                  type="button"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="atelier-eye-btn"
                >
                  {showConfirm
                    ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                    : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
              {resetForm.formState.errors.confirmPassword && (
                <p className="atelier-field-error" role="alert">
                  {resetForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={resetForm.formState.isSubmitting}
                className="atelier-btn-primary"
              >
                {resetForm.formState.isSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                )}
                Reset Password
              </button>
            </div>
          </form>
        </div>
      </Shell>
    );
  }

  // ── OTP step — verify email ───────────────────────────────────────────────
  if (step === "otp") {
    return (
      <Shell>
        <div className="flex flex-col items-center mb-10">
          <div className="mb-5">
            <Image src="/new_logo_1.png" alt="Jobnest" width={52} height={52} priority />
          </div>
          <h1 className="atelier-headline text-4xl text-center mb-2">Verify your email</h1>
          <p className="atelier-subtext text-center">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
        </div>

        <div className="atelier-card">
          <button
            type="button"
            aria-label="Back to email entry"
            onClick={() => { setStep("email"); setOtp(["", "", "", "", "", ""]); setError(null); }}
            className="atelier-back-btn"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back
          </button>

          {error && <p className="atelier-error" role="alert">{error}</p>}

          <div className="flex justify-center gap-2 mb-8">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { otpRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                placeholder=" "
                aria-label={`Verification code digit ${index + 1}`}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                onPaste={handleOtpPaste}
                disabled={isVerifying}
                className="atelier-otp-box"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => verifyOtp(otp.join(""))}
            disabled={isVerifying || otp.some((d) => !d)}
            className="atelier-btn-primary"
          >
            {isVerifying && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Verify Code
          </button>

          <p className="atelier-resend-text">
            Didn&apos;t receive it?{" "}
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || isSendingOtp}
              className="atelier-link-primary"
            >
              {isSendingOtp ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
            </button>
          </p>
        </div>
      </Shell>
    );
  }

  // ── Email step ────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="flex flex-col items-center mb-10">
        <div className="mb-5">
          <Image src="/new_logo_1.png" alt="Jobnest" width={52} height={52} priority />
        </div>
        <h1 className="atelier-headline text-4xl text-center mb-2">Forgot password?</h1>
        <p className="atelier-subtext text-center">
          Enter your email and we&apos;ll send you a verification code.
        </p>
      </div>

      <div className="atelier-card">
        {error && <p className="atelier-error" role="alert">{error}</p>}

        <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-6" noValidate>
          <div>
            <label htmlFor="fp-email" className="atelier-label">Email address</label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              {...emailForm.register("email")}
              className={`atelier-input${emailForm.formState.errors.email ? " atelier-input-error-state" : ""}`}
            />
            {emailForm.formState.errors.email && (
              <p className="atelier-field-error" role="alert">
                {emailForm.formState.errors.email.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={emailForm.formState.isSubmitting || isSendingOtp}
            className="atelier-btn-primary"
          >
            {(emailForm.formState.isSubmitting || isSendingOtp) && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            {isSendingOtp ? "Sending code…" : "Send Verification Code"}
          </button>
        </form>
      </div>

      <p className="atelier-footer-text text-center mt-8">
        Remember your password?{" "}
        <Link href="/login" className="atelier-link-primary ml-1">Sign In</Link>
      </p>
    </Shell>
  );
}
