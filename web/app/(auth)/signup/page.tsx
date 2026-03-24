"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2, ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signupSchema, type SignupFormData } from "@/lib/validations/application";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
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

type SignupStep = "form" | "otp" | "success";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<SignupStep>("form");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpVerifyingRef = useRef(false);
  const otpSendingRef = useRef(false);
  const signupRef = useRef(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
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
        body: JSON.stringify({ email: emailToSend, purpose: "signup" }),
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
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signupError) {
        setError(signupError.message);
        return;
      }

      setIsSendingOtp(true);
      const sent = await sendOtp(data.email);
      setIsSendingOtp(false);

      if (sent) {
        setStep("otp");
      }
    } finally {
      signupRef.current = false;
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

  const handleBackToForm = () => {
    setStep("form");
    setOtp(["", "", "", "", "", ""]);
    setError(null);
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
              <h2 className="text-xl font-semibold">Account created!</h2>
              <p className="text-sm text-muted-foreground">
                Your email has been verified. You can now sign in.
              </p>
            </div>
            <Link href="/login">
              <Button className="mt-4">
                Sign in
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "otp") {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <button
            type="button"
            onClick={handleBackToForm}
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
            Verify Email
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Didn&apos;t receive the code?{" "}
              <button
                type="button"
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
      <CardHeader className="space-y-1 items-center text-center">
        <Image src="/logo_1.png" alt="Jobnest" width={48} height={48} className="mb-1" />
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>Start tracking your job applications today</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

        {/* OAuth buttons */}
        <div className="grid grid-cols-2 gap-3">
          {(["google", "github"] as const).map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => handleOAuth(provider)}
              disabled={!!oauthLoading}
              className="flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {oauthLoading === provider
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : provider === "google" ? <GoogleIcon /> : <GitHubIcon />
              }
              {provider === "google" ? "Google" : "GitHub"}
            </button>
          ))}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register("password")}
              className={errors.password ? "border-destructive" : ""}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              className={errors.confirmPassword ? "border-destructive" : ""}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || isSendingOtp || !!oauthLoading}>
            {(isSubmitting || isSendingOtp) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSendingOtp ? "Sending code..." : "Create Account"}
          </Button>
        </form>

        <p className="mt-2 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
