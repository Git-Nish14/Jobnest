"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, User, Trash2, Check, ArrowLeft,
  Mail, Eye, EyeOff, ShieldAlert, RotateCcw, BrainCircuit, Bell,
  Shield, CalendarDays, KeyRound, AlertTriangle,
} from "lucide-react";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Avatar,
  AvatarFallback,
} from "@/components/ui";

interface ProfileUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  passwordChangedAt: string | null;
  aboutMe: string;
  nestaiContext: string;
  hasPassword: boolean;
  notificationPrefs: {
    overdueReminders: boolean;
    weeklyDigest: boolean;
  };
}

interface PendingDeletion {
  scheduled_deletion_at: string;
  created_at: string;
}

interface ProfileClientProps {
  user: ProfileUser;
  pendingDeletion: PendingDeletion | null;
}

type ChangePasswordStep = "current-password" | "otp" | "new-password";
type DeleteStep = "idle" | "warn" | "sending-otp" | "otp" | "done";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function ProfileClient({ user, pendingDeletion: initialPendingDeletion }: ProfileClientProps) {
  const router = useRouter();

  // ── Display name ──────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user.displayName);
  const [nameInput, setNameInput] = useState(user.displayName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  // ── Password changed tracking ─────────────────────────────────────────────
  const [passwordChangedAt, setPasswordChangedAt] = useState<string | null>(user.passwordChangedAt);
  const [hasPw, setHasPw] = useState(user.hasPassword);

  // ── Change password ───────────────────────────────────────────────────────
  const [pwStep, setPwStep] = useState<ChangePasswordStep>("current-password");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwOtp, setPwOtp] = useState(["", "", "", "", "", ""]);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwResendCooldown, setPwResendCooldown] = useState(0);
  const pwOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pwSendingRef = useRef(false);
  const pwVerifyingRef = useRef(false);
  const [forgotPw, setForgotPw] = useState(false);
  const [pwOtpVerifying, setPwOtpVerifying] = useState(false);
  const [pwRedirectCountdown, setPwRedirectCountdown] = useState<number | null>(null);

  // ── Delete account ────────────────────────────────────────────────────────
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(initialPendingDeletion);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>("idle");
  const [deleteOtp, setDeleteOtp] = useState(["", "", "", "", "", ""]);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSendingOtp, setDeleteSendingOtp] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteResendCooldown, setDeleteResendCooldown] = useState(0);
  const [cancelLoading, setCancelLoading] = useState(false);
  const deleteOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const deleteSendingRef = useRef(false);

  // ── About Me ──────────────────────────────────────────────────────────────
  const [aboutMeInput, setAboutMeInput] = useState(user.aboutMe);
  const [aboutMeSaving, setAboutMeSaving] = useState(false);
  const [aboutMeError, setAboutMeError] = useState<string | null>(null);
  const [aboutMeSuccess, setAboutMeSuccess] = useState(false);

  const handleAboutMeSave = async () => {
    setAboutMeError(null);
    setAboutMeSuccess(false);
    setAboutMeSaving(true);
    try {
      const res = await fetchWithRetry("/api/profile/update-about-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aboutMe: aboutMeInput }),
      });
      const data = await res.json();
      if (!res.ok) { setAboutMeError(data.error || "Failed to save"); return; }
      setAboutMeSuccess(true);
      setTimeout(() => setAboutMeSuccess(false), 3000);
    } catch {
      setAboutMeError("Failed to save. Please try again.");
    } finally {
      setAboutMeSaving(false);
    }
  };

  // ── NESTAi Context (separate from About Me) ───────────────────────────────
  const [nestaiInput, setNestaiInput] = useState(user.nestaiContext);
  const [nestaiSaving, setNestaiSaving] = useState(false);
  const [nestaiError, setNestaiError] = useState<string | null>(null);
  const [nestaiSuccess, setNestaiSuccess] = useState(false);

  const handleNestaiSave = async () => {
    setNestaiError(null);
    setNestaiSuccess(false);
    setNestaiSaving(true);
    try {
      const res = await fetchWithRetry("/api/profile/update-nestai-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nestaiContext: nestaiInput }),
      });
      const data = await res.json();
      if (!res.ok) { setNestaiError(data.error || "Failed to save"); return; }
      setNestaiSuccess(true);
      setTimeout(() => setNestaiSuccess(false), 3000);
    } catch {
      setNestaiError("Failed to save. Please try again.");
    } finally {
      setNestaiSaving(false);
    }
  };

  // ── Notification preferences ───────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState(user.notificationPrefs);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifSuccess, setNotifSuccess] = useState(false);

  const handleNotifSave = async () => {
    setNotifError(null);
    setNotifSuccess(false);
    setNotifSaving(true);
    try {
      const res = await fetchWithRetry("/api/profile/update-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overdueReminders: notifPrefs.overdueReminders,
          weeklyDigest: notifPrefs.weeklyDigest,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setNotifError(data.error || "Failed to save"); return; }
      setNotifSuccess(true);
      setTimeout(() => setNotifSuccess(false), 3000);
    } catch {
      setNotifError("Failed to save. Please try again.");
    } finally {
      setNotifSaving(false);
    }
  };

  // ── Cooldown timers ───────────────────────────────────────────────────────
  useEffect(() => {
    if (pwResendCooldown <= 0) return;
    const t = setTimeout(() => setPwResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [pwResendCooldown]);

  useEffect(() => {
    if (deleteResendCooldown <= 0) return;
    const t = setTimeout(() => setDeleteResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [deleteResendCooldown]);

  // After password change — count down then redirect to /login
  useEffect(() => {
    if (pwRedirectCountdown === null) return;
    if (pwRedirectCountdown <= 0) {
      createClient().auth.signOut().finally(() => router.push("/login"));
      return;
    }
    const t = setTimeout(() => setPwRedirectCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [pwRedirectCountdown, router]);

  // Auto-focus first OTP box when those steps appear
  useEffect(() => {
    if (pwStep === "otp") pwOtpRefs.current[0]?.focus();
  }, [pwStep]);

  useEffect(() => {
    if (deleteStep === "otp") deleteOtpRefs.current[0]?.focus();
  }, [deleteStep]);

  // ── Display name handlers ─────────────────────────────────────────────────
  const handleNameSave = async () => {
    setNameError(null);
    setNameSuccess(false);
    setNameSaving(true);
    try {
      const res = await fetchWithRetry("/api/profile/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nameInput }),
      });
      const data = await res.json();
      if (!res.ok) { setNameError(data.error || "Failed to update display name"); return; }
      setDisplayName(nameInput);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch {
      setNameError("Failed to update display name. Please try again.");
    } finally {
      setNameSaving(false);
    }
  };

  // ── Change password handlers ──────────────────────────────────────────────
  const sendPasswordOtp = async (isResend = false) => {
    if (pwSendingRef.current) return;
    pwSendingRef.current = true;
    setPwError(null);
    setPwLoading(true);
    try {
      const res = await fetchWithRetry("/api/profile/verify-password-send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error || "Failed to verify password"); return; }
      setPwResendCooldown(60);
      if (!isResend) setPwStep("otp");
      else { setPwOtp(["", "", "", "", "", ""]); pwOtpRefs.current[0]?.focus(); }
    } catch {
      setPwError("Failed to send verification code. Please try again.");
    } finally {
      setPwLoading(false);
      pwSendingRef.current = false;
    }
  };

  const handlePwOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...pwOtp];
    next[index] = digit;
    setPwOtp(next);
    if (digit && index < 5) pwOtpRefs.current[index + 1]?.focus();
    // No auto-advance — user must click Continue which verifies the OTP first
  };

  const handlePwOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pwOtp[index] && index > 0) pwOtpRefs.current[index - 1]?.focus();
  };

  const handlePwOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) setPwOtp(pasted.split(""));
    // No auto-advance on paste either
  };

  const verifyPwOtp = async () => {
    if (pwOtpVerifying || !pwOtp.every(Boolean)) return;
    setPwOtpVerifying(true);
    setPwError(null);
    try {
      const res = await fetchWithRetry("/api/profile/verify-change-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: pwOtp.join("") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error || "Invalid verification code");
        setPwOtp(["", "", "", "", "", ""]);
        pwOtpRefs.current[0]?.focus();
        return;
      }
      setPwStep("new-password");
    } catch {
      setPwError("Verification failed. Please try again.");
    } finally {
      setPwOtpVerifying(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwVerifyingRef.current) return;
    if (newPassword !== confirmPassword) { setPwError("Passwords do not match"); return; }
    pwVerifyingRef.current = true;
    setPwError(null);
    setPwLoading(true);
    try {
      const res = await fetchWithRetry("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: pwOtp.join(""), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error || "Failed to change password"); return; }
      setPasswordChangedAt(new Date().toISOString());
      setHasPw(true);
      setPwSuccess(true);
      // Start 5-second countdown → sign out all devices → redirect to /login
      setPwRedirectCountdown(5);
    } catch {
      setPwError("Failed to change password. Please try again.");
    } finally {
      setPwLoading(false);
      pwVerifyingRef.current = false;
    }
  };

  // Send OTP directly without verifying current password (OAuth users + forgot flow)
  const sendOtpDirect = async (isResend = false) => {
    if (pwSendingRef.current) return;
    pwSendingRef.current = true;
    setPwError(null);
    setPwLoading(true);
    try {
      const res = await fetchWithRetry("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, purpose: "change_password" }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error || "Failed to send code"); return; }
      setPwResendCooldown(60);
      if (!isResend) setPwStep("otp");
      else { setPwOtp(["", "", "", "", "", ""]); pwOtpRefs.current[0]?.focus(); }
    } catch {
      setPwError("Failed to send verification code. Please try again.");
    } finally {
      setPwLoading(false);
      pwSendingRef.current = false;
    }
  };

  const resetPwFlow = () => {
    setPwStep("current-password");
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setPwOtp(["", "", "", "", "", ""]); setPwError(null);
    setForgotPw(false);
  };

  // ── Delete account handlers ───────────────────────────────────────────────
  const sendDeleteOtp = async (isResend = false) => {
    if (deleteSendingRef.current) return;
    deleteSendingRef.current = true;
    setDeleteError(null);
    setDeleteSendingOtp(true);
    try {
      const res = await fetchWithRetry("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, purpose: "delete_account" }),
      });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.error || "Failed to send code"); return; }
      setDeleteResendCooldown(60);
      if (!isResend) setDeleteStep("otp");
      else { setDeleteOtp(["", "", "", "", "", ""]); deleteOtpRefs.current[0]?.focus(); }
    } catch {
      setDeleteError("Failed to send verification code. Please try again.");
    } finally {
      setDeleteSendingOtp(false);
      deleteSendingRef.current = false;
    }
  };

  const handleDeleteOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...deleteOtp];
    next[index] = digit;
    setDeleteOtp(next);
    if (digit && index < 5) deleteOtpRefs.current[index + 1]?.focus();
  };

  const handleDeleteOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !deleteOtp[index] && index > 0) deleteOtpRefs.current[index - 1]?.focus();
  };

  const handleDeleteOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) setDeleteOtp(pasted.split(""));
  };

  const handleConfirmDelete = async () => {
    if (!deleteOtp.every(Boolean)) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const res = await fetchWithRetry("/api/profile/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: deleteOtp.join(""),
          reason: deleteReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.error || "Failed to schedule deletion"); return; }
      router.push("/login");
    } catch {
      setDeleteError("Failed to schedule deletion. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    setCancelLoading(true);
    try {
      const res = await fetchWithRetry("/api/profile/reactivate-account", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.error || "Failed to cancel deletion"); return; }
      setPendingDeletion(null);
      setDeleteStep("idle");
      setDeleteError(null);
      router.refresh(); // refresh layout so banner disappears too
    } catch {
      setDeleteError("Failed to cancel deletion. Please try again.");
    } finally {
      setCancelLoading(false);
    }
  };

  const resetDeleteFlow = () => {
    setDeleteStep("idle");
    setDeleteOtp(["", "", "", "", "", ""]);
    setDeleteReason(""); setDeleteError(null);
  };

  const initial = (displayName || user.email).charAt(0).toUpperCase();

  // ── Helpers ───────────────────────────────────────────────────────────────

  function Callout({ type, children }: { type: "error" | "success"; children: React.ReactNode }) {
    return (
      <div className={`flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-sm mb-4 ${
        type === "error"
          ? "bg-destructive/8 border border-destructive/20 text-destructive"
          : "bg-emerald-50 border border-emerald-200 text-emerald-700"
      }`}>
        {type === "success" && <Check className="h-4 w-4 shrink-0 mt-0.5" />}
        <span>{children}</span>
      </div>
    );
  }

  function OtpRow({ values, refs, onChange, onKeyDown, onPaste, danger = false }: {
    values: string[]; refs: React.MutableRefObject<(HTMLInputElement | null)[]>;
    onChange: (i: number, v: string) => void; onKeyDown: (i: number, e: React.KeyboardEvent) => void;
    onPaste: (e: React.ClipboardEvent) => void; danger?: boolean;
  }) {
    return (
      <div className="flex gap-2">
        {values.map((digit, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
            value={digit} onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)} onPaste={onPaste}
            aria-label={`Digit ${i + 1}`}
            className={`h-12 w-11 rounded-xl border-2 bg-background text-center text-lg font-semibold transition-all focus:outline-none focus:ring-0 ${
              danger
                ? `border-destructive/30 focus:border-destructive text-destructive ${digit ? "border-destructive/60" : ""}`
                : `border-border focus:border-primary ${digit ? "border-primary/60 bg-primary/5" : ""}`
            }`}
          />
        ))}
      </div>
    );
  }

  function PwInput({ id, label, value, show, onToggle, onChange, onKeyDown }: {
    id: string; label: string; value: string; show: boolean;
    onToggle: () => void; onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void;
  }) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <div className="relative">
          <Input id={id} type={show ? "text" : "password"} value={value} placeholder="••••••••"
            onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} className="pr-10" />
          <button type="button" onClick={onToggle} aria-label={show ? "Hide" : "Show"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl">

      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, security and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

        {/* ── Left sidebar ──────────────────────────────────────────────── */}
        <aside className="w-full lg:w-67 shrink-0">
          <div className="lg:sticky lg:top-6 space-y-4">

            {/* Profile card */}
            <Card className="overflow-hidden shadow-sm">
              <div className="h-20 bg-linear-to-br from-primary/30 via-primary/12 to-transparent" />
              <CardContent className="px-5 pb-5 -mt-10">
                <Avatar className="h-18 w-18 border-4 border-background shadow-md">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {initial}
                  </AvatarFallback>
                </Avatar>

                <div className="mt-3 min-w-0">
                  <p className="font-bold text-base leading-tight truncate">
                    {displayName || user.email.split("@")[0]}
                  </p>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{user.email}</p>
                </div>

                <div className="mt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Free plan
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t space-y-3">
                  {[
                    { icon: CalendarDays, label: "Joined", value: formatDate(user.createdAt) },
                    {
                      icon: KeyRound,
                      label: hasPw ? "Last password change" : "Sign in",
                      value: !hasPw ? "OAuth only" : passwordChangedAt ? formatDate(passwordChangedAt) : "Set at signup",
                    },
                    {
                      icon: Shield,
                      label: "Auth method",
                      value: hasPw ? "Email + OAuth" : "Google / GitHub",
                    },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium leading-none">{label}</p>
                        <p className="text-sm font-medium truncate mt-1">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick nav — desktop only */}
            <nav className="hidden lg:block rounded-xl border bg-card shadow-sm overflow-hidden">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold px-4 pt-3 pb-1.5">Settings</p>
              {[
                { label: "Display Name", href: "#display-name", icon: User },
                { label: "About You", href: "#about", icon: User },
                { label: "NESTAi Context", href: "#nestai", icon: BrainCircuit },
                { label: "Notifications", href: "#notifications", icon: Bell },
                { label: hasPw ? "Change Password" : "Set Password", href: "#password", icon: Shield },
                { label: "Danger Zone", href: "#danger", icon: AlertTriangle, danger: true },
              ].map(({ label, href, icon: Icon, danger }) => (
                <a key={href} href={href}
                  className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-muted/60 border-t border-border/40 ${
                    danger ? "text-destructive/80 hover:text-destructive" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </a>
              ))}
            </nav>

          </div>
        </aside>

        {/* ── Right content ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Display Name */}
          <Card id="display-name" className="shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
                Display Name
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 ml-9">
                How your name appears across the app — set during onboarding.
                Saved as <code className="text-[10px] bg-muted rounded px-1 py-0.5">display_name</code> in your account.
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {nameError && <Callout type="error">{nameError}</Callout>}
              {nameSuccess && <Callout type="success">Display name updated successfully.</Callout>}
              <div className="flex gap-3">
                <Input id="displayName" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your display name" maxLength={64} className="flex-1" />
                <Button onClick={handleNameSave} disabled={nameSaving || nameInput === displayName} className="shrink-0">
                  {nameSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">Save</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Leave blank to use the first part of your email address.</p>
            </CardContent>
          </Card>

          {/* About You — profile bio from onboarding */}
          <Card id="about" className="shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
                About You
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 ml-9">
                Your profile bio — shown on your account and filled in during onboarding.
                Saved as <code className="text-[10px] bg-muted rounded px-1 py-0.5">about_me</code> in your account.
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {aboutMeError && <Callout type="error">{aboutMeError}</Callout>}
              {aboutMeSuccess && <Callout type="success">Bio updated.</Callout>}
              <textarea
                id="aboutMe"
                value={aboutMeInput}
                onChange={(e) => setAboutMeInput(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="e.g. Software engineer with 3 years of experience, targeting senior roles at product companies in NYC."
                className="w-full rounded-xl border bg-muted/20 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-shadow"
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{aboutMeInput.length} / 2000</p>
                <Button onClick={handleAboutMeSave} disabled={aboutMeSaving || aboutMeInput === user.aboutMe} size="sm">
                  {aboutMeSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* NESTAi Context — separate AI-specific context */}
          <Card id="nestai" className="shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                <div className="h-7 w-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                  <BrainCircuit className="h-3.5 w-3.5" />
                </div>
                NESTAi Context
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 ml-9">
                Custom instructions injected into every NESTAi conversation — separate from your bio above.
                If blank, NESTAi falls back to your About You bio.
                Saved as <code className="text-[10px] bg-muted rounded px-1 py-0.5">nestai_context</code> in your account.
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {nestaiError && <Callout type="error">{nestaiError}</Callout>}
              {nestaiSuccess && <Callout type="success">Saved — NESTAi will use this in every conversation.</Callout>}
              <textarea
                id="nestaiContext"
                value={nestaiInput}
                onChange={(e) => setNestaiInput(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="e.g. I am applying to senior frontend roles. Always refer to me by first name. Focus on React, TypeScript, and system design when reviewing my materials."
                className="w-full rounded-xl border bg-muted/20 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-shadow"
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{nestaiInput.length} / 2000</p>
                <Button onClick={handleNestaiSave} disabled={nestaiSaving || nestaiInput === user.nestaiContext} size="sm">
                  {nestaiSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Context
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card id="notifications" className="shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Bell className="h-3.5 w-3.5" />
                </div>
                Notifications
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 ml-9">Choose which emails Jobnest sends you</p>
            </CardHeader>
            <CardContent className="pt-4">
              {notifError && <Callout type="error">{notifError}</Callout>}
              {notifSuccess && <Callout type="success">Preferences saved.</Callout>}
              <div className="divide-y">
                {([
                  { key: "overdueReminders" as const, label: "Overdue reminder alerts", description: "Email me when follow-up reminders are overdue" },
                  { key: "weeklyDigest" as const, label: "Weekly digest", description: "Applications, upcoming interviews, and overdue reminders" },
                ]).map(({ key, label, description }) => (
                  <label key={key} className="flex items-center justify-between gap-4 py-3.5 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </div>
                    <div className="relative shrink-0">
                      <input type="checkbox" className="peer sr-only" checked={notifPrefs[key]}
                        onChange={(e) => setNotifPrefs((p) => ({ ...p, [key]: e.target.checked }))} />
                      <div className="h-6 w-11 rounded-full border-2 border-input bg-muted transition-colors peer-checked:bg-primary peer-checked:border-primary" />
                      <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white dark:bg-[#ccff00] shadow-sm transition-transform peer-checked:translate-x-5" />
                    </div>
                  </label>
                ))}
              </div>
              <div className="pt-4">
                <Button onClick={handleNotifSave} disabled={notifSaving} size="sm">
                  {notifSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Password */}
          <Card id="password" className="shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Shield className="h-3.5 w-3.5" />
                </div>
                {hasPw ? "Change Password" : "Set Password"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 ml-9">
                {hasPw ? "Update your password — you'll verify your email with a one-time code" : "Add a password to also sign in with email"}
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {pwSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <Shield className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-900">
                        Password {hasPw ? "changed" : "set"} successfully
                      </p>
                      <p className="text-sm text-emerald-700 mt-1 leading-relaxed">
                        For your security, you&apos;ve been signed out of all devices.
                        Sign in again with your new password to continue.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-13">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        setPwRedirectCountdown(0);
                      }}
                    >
                      Sign in now
                    </Button>
                    {pwRedirectCountdown !== null && pwRedirectCountdown > 0 && (
                      <p className="text-xs text-emerald-600">
                        Redirecting in {pwRedirectCountdown}s…
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {pwError && <Callout type="error">{pwError}</Callout>}

                  {pwStep === "current-password" && (
                    <div className="space-y-4">
                      {!hasPw && (
                        <p className="text-sm text-muted-foreground">Your account uses Google / GitHub. Setting a password lets you also sign in with your email.</p>
                      )}
                      {hasPw && !forgotPw && (
                        <div className="space-y-4">
                          <PwInput id="currentPassword" label="Current Password" value={currentPassword} show={showCurrentPw}
                            onToggle={() => setShowCurrentPw(!showCurrentPw)} onChange={setCurrentPassword}
                            onKeyDown={(e) => { if (e.key === "Enter" && currentPassword) sendPasswordOtp(); }} />
                          <div className="flex items-center gap-4">
                            <Button onClick={() => sendPasswordOtp()} disabled={pwLoading || !currentPassword}>
                              {pwLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {pwLoading ? "Sending…" : "Continue"}
                            </Button>
                            <button type="button" onClick={() => { setForgotPw(true); sendOtpDirect(); }} disabled={pwLoading}
                              className="text-sm text-primary hover:underline disabled:opacity-50">Forgot password?</button>
                          </div>
                        </div>
                      )}
                      {hasPw && forgotPw && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                            <Mail className="h-4 w-4 text-primary shrink-0" />
                            <p className="text-sm text-muted-foreground">Code will be sent to <span className="font-medium text-foreground">{user.email}</span></p>
                          </div>
                          <div className="flex items-center gap-4">
                            <Button onClick={() => sendOtpDirect()} disabled={pwLoading}>
                              {pwLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {pwLoading ? "Sending…" : "Send Code"}
                            </Button>
                            <button type="button" onClick={() => setForgotPw(false)} className="text-sm text-muted-foreground hover:text-foreground">← Use current password</button>
                          </div>
                        </div>
                      )}
                      {!hasPw && (
                        <Button onClick={() => sendOtpDirect()} disabled={pwLoading}>
                          {pwLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {pwLoading ? "Sending…" : "Send Verification Code"}
                        </Button>
                      )}
                    </div>
                  )}

                  {pwStep === "otp" && (
                    <div className="space-y-5">
                      <button type="button" onClick={resetPwFlow} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <div className="rounded-xl bg-muted/30 border p-4 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Mail className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Check your email</p>
                            <p className="text-xs text-muted-foreground">Code sent to {user.email}</p>
                          </div>
                        </div>
                        <OtpRow values={pwOtp} refs={pwOtpRefs} onChange={handlePwOtpChange} onKeyDown={handlePwOtpKeyDown} onPaste={handlePwOtpPaste} />
                      </div>
                      <div className="flex items-center gap-4">
                        <Button onClick={verifyPwOtp} disabled={!pwOtp.every(Boolean) || pwOtpVerifying}>
                          {pwOtpVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {pwOtpVerifying ? "Verifying…" : "Verify Code"}
                        </Button>
                        <button type="button" onClick={() => (forgotPw || !hasPw) ? sendOtpDirect(true) : sendPasswordOtp(true)}
                          disabled={pwResendCooldown > 0 || pwLoading}
                          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed">
                          {pwLoading ? "Sending…" : pwResendCooldown > 0 ? `Resend in ${pwResendCooldown}s` : "Resend code"}
                        </button>
                      </div>
                    </div>
                  )}

                  {pwStep === "new-password" && (
                    <div className="space-y-4">
                      <button type="button" onClick={() => setPwStep("otp")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <PwInput id="newPassword" label={hasPw ? "New Password" : "Password"} value={newPassword} show={showNewPw}
                        onToggle={() => setShowNewPw(!showNewPw)} onChange={setNewPassword} />
                      <PwInput id="confirmPassword" label="Confirm Password" value={confirmPassword} show={showConfirmPw}
                        onToggle={() => setShowConfirmPw(!showConfirmPw)} onChange={setConfirmPassword}
                        onKeyDown={(e) => { if (e.key === "Enter" && newPassword && confirmPassword) handleChangePassword(); }} />
                      <p className="text-xs text-muted-foreground">Min 8 characters — uppercase, lowercase, and a number.</p>
                      <Button onClick={handleChangePassword} disabled={pwLoading || !newPassword || !confirmPassword}>
                        {pwLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {hasPw ? "Change Password" : "Set Password"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card id="danger" className={`shadow-sm border-l-4 ${pendingDeletion ? "border-l-orange-400" : "border-l-destructive/50"}`}>
            <CardHeader className="pb-0">
              <CardTitle className={`flex items-center gap-2.5 text-sm font-semibold ${pendingDeletion ? "text-orange-700" : "text-destructive"}`}>
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${pendingDeletion ? "bg-orange-50 text-orange-600" : "bg-destructive/10 text-destructive"}`}>
                  {pendingDeletion ? <ShieldAlert className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                </div>
                Danger Zone
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 ml-9">
                {pendingDeletion
                  ? `Deletion on ${formatDate(pendingDeletion.scheduled_deletion_at)} — ${daysUntil(pendingDeletion.scheduled_deletion_at)} days remaining`
                  : "Permanently remove your account and all data after a 30-day grace period"}
              </p>
            </CardHeader>
            <CardContent className="pt-4">

              {pendingDeletion && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-orange-900">Deletion scheduled</p>
                        <p className="text-sm text-orange-700">Permanent on <strong>{formatDate(pendingDeletion.scheduled_deletion_at)}</strong>. Final warning 24 hours before.</p>
                        <p className="text-xs text-orange-600 mt-1">Sign back in any time to cancel.</p>
                      </div>
                    </div>
                  </div>
                  {deleteError && <Callout type="error">{deleteError}</Callout>}
                  <Button variant="outline" className="border-emerald-500 text-emerald-700 hover:bg-emerald-500 hover:text-white"
                    onClick={handleCancelDeletion} disabled={cancelLoading}>
                    {cancelLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling…</> : <><RotateCcw className="mr-2 h-4 w-4" />Cancel &amp; Keep Account</>}
                  </Button>
                </div>
              )}

              {!pendingDeletion && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-muted/30 border p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">What happens:</p>
                    <ul className="space-y-1.5">
                      {[
                        "30-day grace period — your account stays fully accessible",
                        "All data queued for deletion (applications, interviews, NESTAi history, salary, contacts)",
                        "Reminder emails every 7 days — cancel any time by signing back in",
                        "After 30 days, deletion is permanent and irreversible",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {deleteStep === "idle" && (
                    <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => setDeleteStep("warn")}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete My Account
                    </Button>
                  )}

                  {deleteStep === "warn" && (
                    <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 space-y-4">
                      <button type="button" onClick={resetDeleteFlow} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3.5 w-3.5" /> Cancel
                      </button>
                      <div className="space-y-1.5">
                        <Label htmlFor="deleteReason" className="text-sm">
                          Reason for leaving <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Input id="deleteReason" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}
                          placeholder="e.g. Found a job, switching tools…" maxLength={500} />
                      </div>
                      {deleteError && <Callout type="error">{deleteError}</Callout>}
                      <Button variant="destructive" onClick={() => sendDeleteOtp()} disabled={deleteSendingOtp}>
                        {deleteSendingOtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : <><Mail className="mr-2 h-4 w-4" />Send Confirmation Code</>}
                      </Button>
                    </div>
                  )}

                  {deleteStep === "otp" && (
                    <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 space-y-4">
                      <button type="button" onClick={() => setDeleteStep("warn")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                          <Mail className="h-4 w-4 text-destructive" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-destructive">Confirm deletion</p>
                          <p className="text-xs text-muted-foreground">Code sent to {user.email}</p>
                        </div>
                      </div>
                      <OtpRow values={deleteOtp} refs={deleteOtpRefs} onChange={handleDeleteOtpChange} onKeyDown={handleDeleteOtpKeyDown} onPaste={handleDeleteOtpPaste} danger />
                      {deleteError && <Callout type="error">{deleteError}</Callout>}
                      <div className="flex items-center gap-4">
                        <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteLoading || !deleteOtp.every(Boolean)}>
                          {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirm Deletion
                        </Button>
                        <button type="button" onClick={() => sendDeleteOtp(true)} disabled={deleteResendCooldown > 0 || deleteSendingOtp}
                          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed">
                          {deleteSendingOtp ? "Sending…" : deleteResendCooldown > 0 ? `Resend in ${deleteResendCooldown}s` : "Resend code"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
