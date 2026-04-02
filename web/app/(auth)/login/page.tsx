"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginFormData } from "@/lib/validations/application";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { createClient } from "@/lib/supabase/client";

type LoginStep = "credentials" | "otp";

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

// ── BrandHeader — defined OUTSIDE the page component so React never recreates
//    its identity on re-renders (avoids unmount/remount on every keystroke)
function BrandHeader({ step, email }: { step: LoginStep; email: string }) {
  return (
    <div className="flex flex-col items-center mb-10">
      <div className="mb-5">
        <Image src="/new_logo_1.png" alt="Jobnest" width={52} height={52} priority className="logo-light" />
        <Image src="/dark_logo.png" alt="Jobnest" width={52} height={52} priority className="logo-dark" />
      </div>
      <h1 className="atelier-headline text-4xl text-center mb-2 leading-tight">
        {step === "otp" ? "Check your email" : "Welcome back"}
      </h1>
      <p className="atelier-subtext text-center">
        {step === "otp" ? (
          <>We sent a code to <strong>{email}</strong></>
        ) : (
          "Track every application. Nail every interview."
        )}
      </p>
    </div>
  );
}

// ── Shared page shell — same as signup, defined outside to avoid remounts
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen px-6 py-12 dark:bg-black">
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

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpVerifyingRef = useRef(false);
  const otpSendingRef = useRef(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

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
        body: JSON.stringify({ email: emailToSend, purpose: "login" }),
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

  const onSubmitCredentials = async (data: LoginFormData) => {
    setError(null);
    setEmail(data.email);
    setPassword(data.password);
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
        body: JSON.stringify({ email, code, purpose: "login", password, rememberMe }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Invalid verification code");
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
        return;
      }
      sessionStorage.setItem("jobnest_session", "active");
      router.push("/dashboard");
      router.refresh();
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

  // ── OTP step ───────────────────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <Shell>
        <BrandHeader step={step} email={email} />
        <div className="atelier-card">
          <button
            type="button"
            aria-label="Back to sign in"
            onClick={() => { setStep("credentials"); setOtp(["", "", "", "", "", ""]); setError(null); }}
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

  // ── Credentials step ───────────────────────────────────────────────────────
  return (
    <Shell>
      <BrandHeader step={step} email={email} />

      <div className="atelier-card">
        {error && <p className="atelier-error" role="alert">{error}</p>}

        {/* OAuth */}
        <div className="grid grid-cols-2 gap-4 mb-8">
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
              {provider === "google" ? "Google" : "GitHub"}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full atelier-divider-line" />
          </div>
          <div className="relative flex justify-center">
            <span className="atelier-divider-label">or continue with email</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmitCredentials)} className="space-y-6" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="email" className="atelier-label">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              {...register("email")}
              className={`atelier-input${errors.email ? " atelier-input-error-state" : ""}`}
            />
            {errors.email && <p className="atelier-field-error" role="alert">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label htmlFor="password" className="atelier-label atelier-label-inline">Password</label>
              <Link href="/forgot-password" className="atelier-forgot-link">Forgot?</Link>
            </div>
            <div className="atelier-input-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
            {errors.password && <p className="atelier-field-error" role="alert">{errors.password.message}</p>}
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-3 py-1 cursor-pointer">
            <input
              type="checkbox"
              className="sr-only appearance-none"
              checked={rememberMe}
              aria-label="Stay signed in for 30 days"
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <div className={`atelier-checkbox-box ${rememberMe ? "atelier-checkbox-box-on" : "atelier-checkbox-box-off"}`}>
              {rememberMe && <Check className="w-3 h-3 text-white" strokeWidth={3} aria-hidden="true" />}
            </div>
            <span className="atelier-checkbox-label">Stay signed in for 30 days</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || isSendingOtp || !!oauthLoading}
            className="atelier-btn-primary"
          >
            {(isSubmitting || isSendingOtp) && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {isSendingOtp ? "Sending code…" : "Sign In"}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="atelier-footer-text">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="atelier-link-primary ml-1">Sign Up</Link>
        </p>
        <div className="mt-10 flex justify-center gap-6">
          <Link href="/privacy" className="atelier-footer-link">Privacy Policy</Link>
          <Link href="/terms" className="atelier-footer-link">Terms of Service</Link>
          <Link href="/contact" className="atelier-footer-link">Support</Link>
        </div>
      </div>
    </Shell>
  );
}
