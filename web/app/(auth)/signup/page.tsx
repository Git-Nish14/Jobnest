"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  signupSchema,
  type SignupFormData,
} from "@/lib/validations/application";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";

type SignupStep = "form" | "otp" | "success";

// ── Password strength ──────────────────────────────────────────────────────────
type StrengthLevel = 0 | 1 | 2 | 3;

function getPasswordStrength(pw: string): StrengthLevel {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw) && /[0-9]/.test(pw)) score++;
  return Math.min(score, 3) as StrengthLevel;
}

const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  0: "",
  1: "Weak — needs uppercase, lowercase & number",
  2: "Almost there — one more requirement",
  3: "Strong password",
};
const STRENGTH_COLOR: Record<StrengthLevel, string> = {
  0: "", 1: "red", 2: "amber", 3: "green",
};

function StrengthMeter({ password }: { password: string }) {
  const level = getPasswordStrength(password);
  if (!password) return null;
  const color = STRENGTH_COLOR[level];
  return (
    <div className="mt-2 px-1">
      <div className="atelier-strength-bars">
        {[1, 2, 3].map((bar) => (
          <div
            key={bar}
            className={`atelier-strength-bar${bar <= level ? ` atelier-strength-bar-${color}` : ""}`}
          />
        ))}
      </div>
      {level > 0 && (
        <p className={`atelier-strength-hint atelier-strength-hint-${color}`}>
          {STRENGTH_LABELS[level]}
        </p>
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

// ── Shell & BrandHeader — defined OUTSIDE the page component so React never
//    recreates their identity on re-renders (avoids unmount/remount on keystroke)
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen px-6 py-16 dark:bg-black">
      {/* Decorative layer — contained so glows don't cause horizontal scroll */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="atelier-glow-top" />
        <div className="atelier-glow-bottom" />
      </div>
      <div className="atelier-grain" />
      <div className="w-full max-w-110 mx-auto relative z-10">{children}</div>
    </main>
  );
}

function BrandHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center mb-10">
      <div className="mb-5">
        <Image src="/new_logo_1.png" alt="Jobnest" width={52} height={52} priority className="logo-light" />
        <Image src="/dark_logo.png" alt="Jobnest" width={52} height={52} priority className="logo-dark" />
      </div>
      <h1 className="atelier-headline text-4xl md:text-5xl text-center mb-3 leading-tight tracking-tight">
        {title}
      </h1>
      {subtitle && <p className="atelier-subtext text-center">{subtitle}</p>}
    </div>
  );
}

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<SignupStep>("form");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpVerifyingRef = useRef(false);
  const otpSendingRef = useRef(false);
  const signupRef = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({ resolver: zodResolver(signupSchema) });

  const watchedPassword = watch("password") ?? "";
  const watchedAgeConfirmed = watch("ageConfirmed");
  const watchedTermsAccepted = watch("termsAccepted");

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (step === "otp") otpRefs.current[0]?.focus();
  }, [step]);

  const handleOAuth = async (provider: "google" | "github") => {
    if (!watchedAgeConfirmed || !watchedTermsAccepted) {
      setError("Please confirm your age (18+) and accept the Terms of Service before continuing.");
      return;
    }
    setError(null);
    setOauthLoading(provider);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) { setError(oauthError.message); setOauthLoading(null); }
  };

  const sendOtp = async (emailToSend: string): Promise<boolean> => {
    if (otpSendingRef.current) return false;
    otpSendingRef.current = true;
    try {
      const response = await fetchWithRetry("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSend, purpose: "signup" }),
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

  const onSubmit = async (data: SignupFormData) => {
    if (signupRef.current) return;
    signupRef.current = true;
    setError(null);
    setEmail(data.email);
    try {
      const supabase = createClient();
      const { error: signupError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { onboarding_completed: false } },
      });
      if (signupError) { setError(signupError.message); return; }
      setIsSendingOtp(true);
      const sent = await sendOtp(data.email);
      setIsSendingOtp(false);
      if (sent) setStep("otp");
    } finally {
      signupRef.current = false;
    }
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
        body: JSON.stringify({ email, code, purpose: "signup" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Invalid verification code");
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
        return;
      }
      setStep("success");
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

  // ── Success step ─────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <Shell>
        <div className="text-center">
          <div className="atelier-success-icon">
            <CheckCircle2 className="w-7 h-7 text-emerald-700" aria-hidden="true" />
          </div>
          <h1 className="atelier-headline text-4xl mb-3">Account created!</h1>
          <p className="atelier-subtext mb-8">Your email has been verified. You&apos;re ready to go.</p>
          <Link href="/login" className="atelier-btn-primary block no-underline">
            Sign In to Jobnest
          </Link>
        </div>
      </Shell>
    );
  }

  // ── OTP step ─────────────────────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <Shell>
        <BrandHeader title="Check your email" subtitle={`We sent a code to ${email}`} />
        <div className="atelier-card">
          <button
            type="button"
            aria-label="Back to sign up form"
            onClick={() => { setStep("form"); setOtp(["", "", "", "", "", ""]); setError(null); }}
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
            Verify Email
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

  // ── Form step ─────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <BrandHeader
        title="Create your account"
        subtitle="Your calm, organised home for every job search."
      />

      <div className="atelier-card">
        {error && <p className="atelier-error" role="alert">{error}</p>}

        {/* OAuth — stacked full-width */}
        <div className="flex flex-col gap-3 mb-8">
          {(["google", "github"] as const).map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => handleOAuth(provider)}
              disabled={!!oauthLoading}
              className="atelier-oauth-btn"
            >
              {oauthLoading === provider
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                : provider === "google" ? <GoogleIcon /> : <GitHubIcon />}
              Continue with {provider === "google" ? "Google" : "GitHub"}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full atelier-divider-line" />
          </div>
          <div className="relative flex justify-center">
            <span className="atelier-divider-label">or email</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="signup-email" className="atelier-label">Email address</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              {...register("email")}
              className={`atelier-input${errors.email ? " atelier-input-error-state" : ""}`}
            />
            {errors.email && <p className="atelier-field-error" role="alert">{errors.email.message}</p>}
          </div>

          {/* Password + strength */}
          <div>
            <label htmlFor="signup-password" className="atelier-label">Password</label>
            <div className="atelier-input-wrap">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("password")}
                className={`atelier-input${errors.password ? " atelier-input-error-state" : ""}`}
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
            <StrengthMeter password={watchedPassword} />
            {errors.password && <p className="atelier-field-error mt-1" role="alert">{errors.password.message}</p>}
          </div>

          {/* Confirm password */}
          <div>
            <label htmlFor="signup-confirm" className="atelier-label">Confirm password</label>
            <div className="atelier-input-wrap">
              <input
                id="signup-confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("confirmPassword")}
                className={`atelier-input${errors.confirmPassword ? " atelier-input-error-state" : ""}`}
              />
              <button
                type="button"
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                onClick={() => setShowConfirm((v) => !v)}
                className="atelier-eye-btn"
              >
                {showConfirm
                  ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                  : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="atelier-field-error" role="alert">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Age confirmation */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="sr-only appearance-none"
                aria-label="I confirm I am 18 years of age or older"
                {...register("ageConfirmed")}
              />
              <div className={`atelier-checkbox-box mt-0.5 ${watchedAgeConfirmed ? "atelier-checkbox-box-on" : "atelier-checkbox-box-off"}`}>
                {watchedAgeConfirmed && <Check className="w-3 h-3 text-white" strokeWidth={3} aria-hidden="true" />}
              </div>
              <span className="atelier-checkbox-label">
                I am <strong>18 years of age or older</strong>
              </span>
            </label>
            {errors.ageConfirmed && (
              <p className="atelier-field-error mt-1 ml-8" role="alert">{errors.ageConfirmed.message}</p>
            )}
          </div>

          {/* Terms acceptance */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="sr-only appearance-none"
                aria-label="I accept the Terms of Service and Privacy Policy"
                {...register("termsAccepted")}
              />
              <div className={`atelier-checkbox-box mt-0.5 ${watchedTermsAccepted ? "atelier-checkbox-box-on" : "atelier-checkbox-box-off"}`}>
                {watchedTermsAccepted && <Check className="w-3 h-3 text-white" strokeWidth={3} aria-hidden="true" />}
              </div>
              <span className="atelier-checkbox-label">
                I accept the{" "}
                <Link href="/terms" className="atelier-link-primary" onClick={(e) => e.stopPropagation()}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="atelier-link-primary" onClick={(e) => e.stopPropagation()}>
                  Privacy Policy
                </Link>
              </span>
            </label>
            {errors.termsAccepted && (
              <p className="atelier-field-error mt-1 ml-8" role="alert">{errors.termsAccepted.message}</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isSendingOtp || !!oauthLoading}
              className="atelier-btn-primary"
            >
              {(isSubmitting || isSendingOtp) && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {isSendingOtp ? "Sending code…" : "Create Account"}
            </button>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center space-y-6">
        <div className="w-12 h-px bg-[#dbc1b933] mx-auto" />
        <p className="atelier-footer-text">
          Already have an account?{" "}
          <Link href="/login" className="atelier-link-primary ml-1">Sign In</Link>
        </p>
      </div>
    </Shell>
  );
}
