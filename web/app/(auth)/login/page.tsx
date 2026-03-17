"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft, Mail, Github } from "lucide-react";
import { loginSchema, type LoginFormData } from "@/lib/validations/application";
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

type LoginStep = "credentials" | "otp";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Handle resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first OTP input when step changes to OTP
  useEffect(() => {
    if (step === "otp" && otpRefs.current[0]) {
      otpRefs.current[0].focus();
    }
  }, [step]);

  const sendOtp = async (emailToSend: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSend, purpose: "login" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send verification code");
        return false;
      }

      setResendCooldown(60);
      return true;
    } catch {
      setError("Failed to send verification code. Please try again.");
      return false;
    }
  };

  const onSubmitCredentials = async (data: LoginFormData) => {
    setError(null);

    // Store credentials for OTP step (password will be validated with OTP)
    setEmail(data.email);
    setPassword(data.password);

    // Send OTP - password validation happens together with OTP verification
    // This prevents attackers from probing password validity without email access
    setIsSendingOtp(true);
    const sent = await sendOtp(data.email);
    setIsSendingOtp(false);

    if (sent) {
      setStep("otp");
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-focus next input
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
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
    setError(null);
    setIsVerifying(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          purpose: "login",
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid verification code");
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
        setIsVerifying(false);
        return;
      }

      // Success - redirect to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Verification failed. Please try again.");
      setIsVerifying(false);
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

  const handleBackToCredentials = () => {
    setStep("credentials");
    setOtp(["", "", "", "", "", ""]);
    setError(null);
  };

  if (step === "otp") {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <button
            onClick={handleBackToCredentials}
            className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </button>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Check your email
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
      <CardHeader className="space-y-1 items-center text-center">
        <Image src="/logo_1.png" alt="Jobnest" width={48} height={48} className="mb-1" />
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>Sign in to track your job applications</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmitCredentials)} className="space-y-4">
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
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
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

          <Button type="submit" className="w-full" disabled={isSubmitting || isSendingOtp}>
            {(isSubmitting || isSendingOtp) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSendingOtp ? "Sending code..." : "Sign In"}
          </Button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" disabled className="gap-2 opacity-50 cursor-not-allowed">
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </Button>
          <Button variant="outline" disabled className="gap-2 opacity-50 cursor-not-allowed">
            <Github className="h-4 w-4" />
            GitHub
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
