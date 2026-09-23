"use client";

import React, { useState, useRef, useEffect, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Trash2, Check, ArrowLeft,
  Mail, Eye, EyeOff, ShieldAlert, RotateCcw, BrainCircuit, Bell,
  Shield, CalendarDays, KeyRound, AlertTriangle, BadgeCheck, Camera, ChevronDown, Gift,
} from "lucide-react";
import { ChatGptIntegration } from "./chatgpt-integration";
import { DeveloperIdentity } from "./developer-identity";
import { ReferralCard } from "./referral-card";
import { ProfileNavigation, ProfilePanel, useProfileNavigation } from "./profile-navigation";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { formatDate as fmtDate } from "@/lib/utils/date";
import { createClient } from "@/lib/supabase/client";
import { WORK_AUTHORIZATION_OPTIONS, type WorkAuthorization } from "@/config";
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
  AvatarImage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

interface ProfileUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  passwordChangedAt: string | null;
  aboutMe: string;
  nestaiContext: string;
  workAuthorization: WorkAuthorization | null;
  optStartDate: string | null;
  stemExtension: boolean;
  hasPassword: boolean;
  oauthProviders: string[];
  notificationPrefs: {
    overdueReminders: boolean;
    weeklyDigest: boolean;
    reEngagementEmails: boolean;
  };
  weeklyGoal: number;
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
  return fmtDate(iso);
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

// ── Shared helper components (module-level so React never unmounts them on
//    parent re-render — nested component definitions get a new reference each
//    render, causing React to unmount/remount and the keyboard to close on iOS)

function Callout({ type, children }: { type: "error" | "success"; children: React.ReactNode }) {
  return (
    <div role={type === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-sm mb-4 ${
      type === "error"
        ? "bg-destructive/8 border border-destructive/20 text-destructive"
        : "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
    }`}>
      {type === "success" && <Check className="h-4 w-4 shrink-0 mt-0.5" />}
      <span>{children}</span>
    </div>
  );
}

function OtpRow({ values, refs, onChange, onKeyDown, onPaste, danger = false }: {
  values: string[];
  refs: MutableRefObject<(HTMLInputElement | null)[]>;
  onChange: (i: number, v: string) => void;
  onKeyDown: (i: number, e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  danger?: boolean;
}) {
  return (
    <div className="grid max-w-[19rem] grid-cols-6 gap-1.5 sm:gap-2">
      {values.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          // type="tel" keeps the numeric keyboard mounted on iOS when focus
          // moves between boxes; type="text" can cause keyboard dismiss.
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          autoComplete="off"
          aria-label={`Digit ${i + 1}`}
          className={`h-12 w-full min-w-0 rounded-xl border-2 bg-background text-center text-lg font-semibold transition-all focus:outline-none focus:ring-0 ${
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

export function ProfileClient({ user, pendingDeletion: initialPendingDeletion }: ProfileClientProps) {
  const router = useRouter();
  const { section, anchor } = useProfileNavigation();

  // ── Display name ──────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user.displayName);
  const [nameInput, setNameInput] = useState(user.displayName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  // ── Avatar ────────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Only JPEG, PNG, or WebP images are allowed");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be under 2 MB");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }

    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/profile/upload-avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setAvatarError(data.error || "Upload failed"); return; }
      setAvatarUrl(data.avatarUrl);
    } catch {
      setAvatarError("Upload failed. Please try again.");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

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

  // ── Weekly goal ───────────────────────────────────────────────────────────
  const [goalDraft,   setGoalDraft]   = useState(String(user.weeklyGoal));
  const [goalSaving,  setGoalSaving]  = useState(false);
  const [goalError,   setGoalError]   = useState<string | null>(null);
  const [goalSuccess, setGoalSuccess] = useState(false);

  const handleGoalSave = async () => {
    const n = parseInt(goalDraft, 10);
    if (isNaN(n) || n < 1 || n > 100) {
      setGoalError("Enter a number between 1 and 100.");
      return;
    }
    setGoalError(null);
    setGoalSuccess(false);
    setGoalSaving(true);
    try {
      const res = await fetchWithRetry("/api/profile/update-weekly-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyGoal: n }),
      });
      const data = await res.json();
      if (!res.ok) { setGoalError(data.error || "Failed to save"); return; }
      // Mirror to localStorage so the dashboard widget picks it up immediately
      localStorage.setItem("jobnest_weekly_goal", String(n));
      setGoalSuccess(true);
      setTimeout(() => setGoalSuccess(false), 3000);
    } catch {
      setGoalError("Failed to save. Please try again.");
    } finally {
      setGoalSaving(false);
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
          reEngagementEmails: notifPrefs.reEngagementEmails,
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

  // ── Work Authorization ────────────────────────────────────────────────────
  const [workAuth, setWorkAuth] = useState<WorkAuthorization | null>(user.workAuthorization);
  const [optStartDate, setOptStartDate] = useState<string>(user.optStartDate ?? "");
  const [stemExtension, setStemExtension] = useState<boolean>(user.stemExtension);
  const [workAuthSaving, setWorkAuthSaving] = useState(false);
  const [workAuthError, setWorkAuthError] = useState<string | null>(null);
  const [workAuthSuccess, setWorkAuthSuccess] = useState(false);

  const handleWorkAuthSave = async () => {
    setWorkAuthError(null);
    setWorkAuthSuccess(false);
    setWorkAuthSaving(true);
    try {
      const res = await fetchWithRetry("/api/profile/update-work-authorization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workAuthorization: workAuth,
          optStartDate: workAuth === "OPT (F-1)" ? (optStartDate || null) : null,
          stemExtension: workAuth === "OPT (F-1)" ? stemExtension : false,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setWorkAuthError(data.error || "Failed to save"); return; }
      setWorkAuthSuccess(true);
      setTimeout(() => setWorkAuthSuccess(false), 3000);
    } catch {
      setWorkAuthError("Failed to save. Please try again.");
    } finally {
      setWorkAuthSaving(false);
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
    // Defer focus so the current keystroke event finishes before shifting focus —
    // prevents iOS Safari from dismissing the keyboard between inputs.
    if (digit && index < 5) setTimeout(() => pwOtpRefs.current[index + 1]?.focus(), 0);
  };

  const handlePwOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pwOtp[index] && index > 0) pwOtpRefs.current[index - 1]?.focus();
  };

  const handlePwOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setPwOtp(pasted.split(""));
      // Focus last box after paste so keyboard stays open and user can submit
      setTimeout(() => pwOtpRefs.current[5]?.focus(), 0);
    }
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
    // Defer focus so the current keystroke event finishes before shifting focus —
    // prevents iOS Safari from dismissing the keyboard between inputs.
    if (digit && index < 5) setTimeout(() => deleteOtpRefs.current[index + 1]?.focus(), 0);
  };

  const handleDeleteOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !deleteOtp[index] && index > 0) deleteOtpRefs.current[index - 1]?.focus();
  };

  const handleDeleteOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDeleteOtp(pasted.split(""));
      setTimeout(() => deleteOtpRefs.current[5]?.focus(), 0);
    }
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

  const providerLabels = user.oauthProviders.map((provider) =>
    provider === "google" ? "Google" : provider === "github" ? "GitHub" : provider === "linkedin_oidc" ? "LinkedIn" : provider.charAt(0).toUpperCase() + provider.slice(1)
  );
  const signInMethod = [hasPw ? "Email & password" : null, ...providerLabels].filter(Boolean).join(" · ") || "Email";

  return (
    <div className="mx-auto max-w-5xl space-y-6 [&_[id]]:scroll-mt-48">
      <header>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Your workspace</p>
        <h1 className="db-page-title">Profile & settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">A little about you. Everything that makes Jobnest yours.</p>
      </header>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5 sm:gap-5 sm:p-6">
        <div className="relative shrink-0">
          <Avatar className="h-16 w-16 border border-border sm:h-18 sm:w-18">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName || user.email} />}
            <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
              {avatarUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : initial}
            </AvatarFallback>
          </Avatar>
          <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50">
            {avatarUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile photo" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="wrap-break-word text-lg font-semibold tracking-tight">{displayName || user.email.split("@")[0]}</p>
          <p className="mt-0.5 break-all text-sm text-muted-foreground">{user.email}</p>
          {avatarError && <p role="alert" className="mt-1.5 text-xs text-destructive">{avatarError}</p>}
        </div>
        <p className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Joined {formatDate(user.createdAt)}</p>
      </div>
      <div className="sticky top-14 z-20 bg-background/95 backdrop-blur-sm sm:top-16">
        <ProfileNavigation section={section} />
      </div>
      <ProfilePanel id="profile" active={section} title="Personal details" description="Manage how you appear across Jobnest.">
        <Card className="overflow-hidden shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div id="display-name" className="max-w-xl">
              <Label htmlFor="displayName">Display name</Label>
              <p className="mb-3 mt-1.5 text-xs text-muted-foreground">The name you use across Jobnest.</p>
              {nameError && <Callout type="error">{nameError}</Callout>}
              {nameSuccess && <Callout type="success">Display name updated successfully.</Callout>}
              <div className="flex gap-3">
                <Input id="displayName" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your display name" maxLength={64} className="min-w-0 flex-1" />
                <Button onClick={handleNameSave} disabled={nameSaving || nameInput === displayName} className="shrink-0" aria-label="Save display name">
                  {nameSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">Save</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Leave blank to use the first part of your email address.</p>
            </div>
            <div id="about" className="mt-6 border-t pt-6">
              <Label htmlFor="aboutMe">About you</Label>
              <p id="about-description" className="mb-3 mt-1.5 text-xs text-muted-foreground">A short introduction to your experience and the work you’re looking for.</p>
              {aboutMeError && <Callout type="error">{aboutMeError}</Callout>}
              {aboutMeSuccess && <Callout type="success">Bio updated.</Callout>}
              <textarea
                id="aboutMe" aria-describedby="about-description"
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
                  Save bio
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </ProfilePanel>
      <ProfilePanel id="career" active={section} title="Your career" description="Set your job search goals and keep your professional background up to date.">
        <div className="grid gap-5 md:grid-cols-2">
          <Card id="goals" className="min-w-0 shadow-none">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                Job Search Goals
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 ml-9">
                Set your weekly application target — shown on the dashboard
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {goalError   && <Callout type="error">{goalError}</Callout>}
              {goalSuccess  && <Callout type="success">Weekly goal saved.</Callout>}
              <div className="flex items-end gap-3">
                <div className="space-y-1.5 min-w-0 flex-1 max-w-40">
                  <Label htmlFor="weekly-goal">Applications per week</Label>
                  <Input
                    id="weekly-goal"
                    type="number"
                    min={1}
                    max={100}
                    value={goalDraft}
                    onChange={(e) => { setGoalDraft(e.target.value); setGoalError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleGoalSave(); }}
                    className="w-full"
                  />
                </div>
                <p className="text-xs text-muted-foreground pb-2">applications / week</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Your goal stays in sync with your dashboard.
              </p>
              <Button onClick={handleGoalSave} disabled={goalSaving} size="sm">
                {goalSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Goal
              </Button>
            </CardContent>
          </Card>
          <Card id="work-authorization" className="min-w-0 shadow-none">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <BadgeCheck className="h-3.5 w-3.5" />
                </div>
                Work Authorization
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 ml-9">
                Your US work authorization status — used to filter sponsorship-required roles.
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {workAuthError && <Callout type="error">{workAuthError}</Callout>}
              {workAuthSuccess && <Callout type="success">Work authorization saved.</Callout>}
              <div className="space-y-3">
                <Select
                  value={workAuth ?? ""}
                  onValueChange={(v) => setWorkAuth((v || null) as WorkAuthorization | null)}
                >
                  <SelectTrigger className="w-full min-w-0 [&>span]:min-w-0 [&>span]:truncate" aria-label="Work authorization status">
                    <SelectValue placeholder="Select your status…" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_AUTHORIZATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {workAuth === "OPT (F-1)" && (
                  <div className="space-y-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800">
                    <p className="text-xs font-semibold text-sky-800 dark:text-sky-300">OPT Details</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="opt-start-date" className="text-xs">OPT Start Date</Label>
                      <Input id="opt-start-date" type="date" value={optStartDate}
                        onChange={(e) => setOptStartDate(e.target.value)} className="h-8 text-sm" />
                      <p className="text-[10px] text-muted-foreground">OPT authorization start date — used to compute the expiry countdown.</p>
                    </div>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={stemExtension}
                        onChange={(e) => setStemExtension(e.target.checked)} className="rounded" />
                      <span className="text-xs text-sky-800 dark:text-sky-300">24-month STEM extension active</span>
                    </label>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Stored only in your account — never shared publicly.</p>
                  <Button onClick={handleWorkAuthSave} disabled={workAuthSaving} size="sm">
                    {workAuthSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <DeveloperIdentity />
      </ProfilePanel>
      <ProfilePanel id="integrations" active={section} title="Connected tools" description="Connect ChatGPT and personalize the help you get from NESTAi.">
        <ChatGptIntegration />
        <Card id="nestai" className="shadow-none">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <BrainCircuit className="h-3.5 w-3.5" />
              </div>
              NESTAi preferences
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 ml-9">
              Tell NESTAi how to help with your job search. Leave this blank to use your profile bio.
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            {nestaiError && <Callout type="error">{nestaiError}</Callout>}
            {nestaiSuccess && <Callout type="success">Saved — NESTAi will use this in every conversation.</Callout>}
            <textarea
              id="nestaiContext" aria-label="NESTAi instructions"
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
      </ProfilePanel>
      <ProfilePanel id="account" active={section} title="Account preferences" description="Choose how you hear from us and manage your account.">
        <Card id="notifications" className="shadow-none">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
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
                { key: "reEngagementEmails" as const, label: "Re-engagement emails", description: "Remind me to check in if I haven't logged in for 14+ days" },
              ]).map(({ key, label, description }) => (
                <label key={key} className="flex items-center justify-between gap-4 py-3.5 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                  <div className="relative shrink-0">
                    <input type="checkbox" role="switch" aria-label={label} className="peer sr-only" checked={notifPrefs[key]}
                      onChange={(e) => setNotifPrefs((p) => ({ ...p, [key]: e.target.checked }))} />
                    <div className="h-6 w-11 rounded-full border-2 border-input bg-muted transition-colors peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2" />
                    <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background peer-checked:bg-primary-foreground shadow-sm transition-transform peer-checked:translate-x-5" />
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
        <details id="password" open={anchor === "password"} className="group/password rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden sm:p-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Password & sign-in</span><span className="mt-1 block text-xs text-muted-foreground">{signInMethod}</span></span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/password:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-4 border-t p-5 sm:p-6">
            <div>
              <h3 className="text-sm font-semibold">{hasPw ? "Change password" : "Set a password"}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{hasPw ? `Last changed: ${passwordChangedAt ? formatDate(passwordChangedAt) : "set at signup"}. Verify your email to update it.` : "Add a password to also sign in with your email."}</p>
            </div>
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
          </div>
        </details>
        <details id="referrals" open={anchor === "referrals"} className="group/referrals rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden sm:p-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Gift className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Refer a friend</span><span className="mt-1 block text-xs text-muted-foreground">Your invite link and referral rewards</span></span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/referrals:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t [&>.db-content-card]:border-0 [&>.db-content-card]:bg-transparent [&>.db-content-card]:shadow-none"><ReferralCard /></div>
        </details>
        <details id="danger" open={anchor === "danger" || Boolean(pendingDeletion)} className="group/danger rounded-xl border border-destructive/20 bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden sm:p-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-destructive">{pendingDeletion ? "Account deletion scheduled" : "Delete account"}</span><span className="mt-1 block text-xs text-muted-foreground">{pendingDeletion ? `Scheduled for ${formatDate(pendingDeletion.scheduled_deletion_at)} · ${daysUntil(pendingDeletion.scheduled_deletion_at)} days remaining` : "Permanently remove your account and data"}</span></span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/danger:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t p-5 sm:p-6">
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
          </div>
        </details>
      </ProfilePanel>
    </div>
  );
}
