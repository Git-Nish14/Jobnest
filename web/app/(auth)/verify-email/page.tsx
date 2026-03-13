"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, CheckCircle2, RefreshCw, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

export default function VerifyEmailPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isReverification, setIsReverification] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const email = searchParams.get("email");
    const reverify = searchParams.get("reverify");

    if (email) {
      setUserEmail(email);
    }

    if (reverify === "true") {
      setIsReverification(true);
    }

    // Get current user email if not provided
    const getCurrentUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };

    if (!email) {
      getCurrentUser();
    }
  }, [searchParams]);

  const handleResendVerification = async () => {
    if (!userEmail) return;

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: userEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?type=verification`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setIsSent(true);
    }

    setIsLoading(false);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleContinue = async () => {
    // Update last reverification timestamp
    const supabase = createClient();
    await supabase.auth.updateUser({
      data: {
        last_reverification: new Date().toISOString(),
      },
    });

    // Clear the reverification cookie
    document.cookie = "needs_reverification=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    router.push("/dashboard");
    router.refresh();
  };

  if (isSent) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Verification email sent!</h2>
              <p className="text-sm text-muted-foreground">
                We&apos;ve sent a new verification link to{" "}
                <span className="font-medium text-foreground">{userEmail}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Please check your inbox and spam folder.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsSent(false)}
              className="mt-4"
            >
              Didn&apos;t receive it? Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold text-center">
          {isReverification ? "Verify your identity" : "Verify your email"}
        </CardTitle>
        <CardDescription className="text-center">
          {isReverification
            ? "For your security, please verify your email address to continue"
            : "Please verify your email address to access your account"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {userEmail && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {isReverification
                ? "We need to verify your email for security:"
                : "We sent a verification link to:"}
            </p>
            <p className="font-medium mt-1">{userEmail}</p>
          </div>
        )}

        {isReverification ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              It&apos;s been 7 days since your last verification.
              This helps keep your account secure.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleResendVerification}
                disabled={isLoading}
                className="w-full gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Send Verification Email
              </Button>
              <Button
                variant="outline"
                onClick={handleContinue}
                className="w-full"
              >
                Skip for now
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Click the link in the email to verify your account.
              If you don&apos;t see it, check your spam folder.
            </p>
            <Button
              onClick={handleResendVerification}
              disabled={isLoading}
              variant="outline"
              className="w-full gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Resend verification email
            </Button>
          </div>
        )}

        <div className="pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full gap-2 text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
