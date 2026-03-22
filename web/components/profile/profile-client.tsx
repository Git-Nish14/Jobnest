"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, User, Lock, Trash2, Check, ArrowLeft,
  Mail, Eye, EyeOff, ShieldAlert, RotateCcw,
} from "lucide-react";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
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
    if (digit && index === 5 && next.every(Boolean)) setPwStep("new-password");
  };

  const handlePwOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pwOtp[index] && index > 0) pwOtpRefs.current[index - 1]?.focus();
  };

  const handlePwOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) { setPwOtp(pasted.split("")); setPwStep("new-password"); }
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
      setPwSuccess(true);
      setTimeout(() => {
        setPwSuccess(false);
        setPwStep("current-password");
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        setPwOtp(["", "", "", "", "", ""]);
      }, 3000);
    } catch {
      setPwError("Failed to change password. Please try again.");
    } finally {
      setPwLoading(false);
      pwVerifyingRef.current = false;
    }
  };

  const resetPwFlow = () => {
    setPwStep("current-password");
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setPwOtp(["", "", "", "", "", ""]); setPwError(null);
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
      setPendingDeletion({
        scheduled_deletion_at: data.scheduledDeletionAt,
        created_at: new Date().toISOString(),
      });
      setDeleteStep("done");
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

  const initials = (displayName || user.email).charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account settings</p>
      </div>

      {/* ── Account Information ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{displayName || user.email.split("@")[0]}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Email</p>
              <p className="text-sm mt-0.5">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Joined</p>
              <p className="text-sm mt-0.5">{formatDate(user.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Plan</p>
              <p className="text-sm mt-0.5">Free</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Last Password Change
              </p>
              <p className="text-sm mt-0.5">
                {passwordChangedAt ? formatDate(passwordChangedAt) : "Never changed"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Display Name ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {nameError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{nameError}</div>
          )}
          {nameSuccess && (
            <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm flex items-center gap-2">
              <Check className="h-4 w-4" /> Display name updated
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your display name"
              maxLength={64}
            />
            <p className="text-xs text-muted-foreground">
              This is how your name appears in the app. Leave blank to use your email.
            </p>
          </div>
          <Button onClick={handleNameSave} disabled={nameSaving || nameInput === displayName} size="sm">
            {nameSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Name
          </Button>
        </CardContent>
      </Card>

      {/* ── Change Password ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pwSuccess ? (
            <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm flex items-center gap-2">
              <Check className="h-4 w-4" /> Password changed successfully!
            </div>
          ) : (
            <div className="space-y-4">
              {pwError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{pwError}</div>
              )}

              {pwStep === "current-password" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPw ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        onKeyDown={(e) => { if (e.key === "Enter" && currentPassword) sendPasswordOtp(); }}
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                        {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button onClick={() => sendPasswordOtp()} disabled={pwLoading || !currentPassword} size="sm">
                    {pwLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {pwLoading ? "Sending code..." : "Send Verification Code"}
                  </Button>
                </div>
              )}

              {pwStep === "otp" && (
                <div className="space-y-4">
                  <button type="button" onClick={resetPwFlow} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </button>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Code sent to <span className="font-medium text-foreground">{user.email}</span>
                    </p>
                  </div>
                  <div className="flex gap-1.5 sm:gap-2">
                    {pwOtp.map((digit, i) => (
                      <Input key={i} ref={(el) => { pwOtpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={(e) => handlePwOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handlePwOtpKeyDown(i, e)} onPaste={handlePwOtpPaste}
                        className="w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-semibold p-0"
                      />
                    ))}
                  </div>
                  <Button size="sm" onClick={() => pwOtp.every(Boolean) && setPwStep("new-password")} disabled={!pwOtp.every(Boolean)}>
                    Continue
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Didn&apos;t receive the code?{" "}
                    <button type="button" onClick={() => sendPasswordOtp(true)} disabled={pwResendCooldown > 0 || pwLoading}
                      className="text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                      {pwLoading ? "Sending..." : pwResendCooldown > 0 ? `Resend in ${pwResendCooldown}s` : "Resend code"}
                    </button>
                  </p>
                </div>
              )}

              {pwStep === "new-password" && (
                <div className="space-y-3">
                  <button type="button" onClick={() => setPwStep("otp")} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </button>
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input id="newPassword" type={showNewPw ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNewPw(!showNewPw)}>
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">At least 8 characters with uppercase, lowercase, and a number.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input id="confirmPassword" type={showConfirmPw ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                        onKeyDown={(e) => { if (e.key === "Enter" && newPassword && confirmPassword) handleChangePassword(); }} />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPw(!showConfirmPw)}>
                        {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button onClick={handleChangePassword} disabled={pwLoading || !newPassword || !confirmPassword} size="sm">
                    {pwLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delete Account ────────────────────────────────────────────────── */}
      <Card className={pendingDeletion ? "border-orange-300" : "border-destructive/40"}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-base ${pendingDeletion ? "text-orange-700" : "text-destructive"}`}>
            <Trash2 className="h-4 w-4" />
            Delete Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">

          {/* ── Already pending deletion ── */}
          {pendingDeletion && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-orange-200 bg-orange-50 space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-orange-900">Deletion scheduled</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Your account will be permanently deleted on{" "}
                      <strong>{formatDate(pendingDeletion.scheduled_deletion_at)}</strong>{" "}
                      — in <strong>{daysUntil(pendingDeletion.scheduled_deletion_at)} days</strong>.
                    </p>
                    <p className="text-xs text-orange-600 mt-2">
                      Reminder emails are sent every 7 days. A final warning will be sent 24 hours before deletion.
                    </p>
                  </div>
                </div>
              </div>

              {deleteError && (
                <div className="p-2 rounded bg-destructive/10 text-destructive text-sm">{deleteError}</div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="border-green-600 text-green-700 hover:bg-green-600 hover:text-white"
                onClick={handleCancelDeletion}
                disabled={cancelLoading}
              >
                {cancelLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling…</>
                  : <><RotateCcw className="mr-2 h-4 w-4" />Cancel Deletion &amp; Restore Account</>
                }
              </Button>
            </div>
          )}

          {/* ── No pending deletion — delete flow ── */}
          {!pendingDeletion && (
            <>
              <p className="text-sm text-muted-foreground">
                Your account won&apos;t be deleted immediately. You&apos;ll have a{" "}
                <strong>30-day grace period</strong> — sign back in any time to restore it.
                Reminder emails every 7 days, plus a final 24-hour warning.
              </p>

              {/* Step: idle */}
              {deleteStep === "idle" && (
                <Button variant="outline" size="sm"
                  className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setDeleteStep("warn")}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete My Account
                </Button>
              )}

              {/* Step: warn — show consequences + send OTP */}
              {deleteStep === "warn" && (
                <div className="space-y-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <button type="button" onClick={resetDeleteFlow} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Cancel
                  </button>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-destructive">Before you continue</p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                      <li>All applications, interviews, contacts, and salary data will be deleted</li>
                      <li>Your NESTAi conversation history will be removed</li>
                      <li>After 30 days this cannot be recovered</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="deleteReason" className="text-xs">
                      Reason for leaving <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="deleteReason"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="e.g. Found a job, switching tools…"
                      maxLength={500}
                    />
                  </div>

                  {deleteError && (
                    <div className="p-2 rounded bg-destructive/10 text-destructive text-sm">{deleteError}</div>
                  )}

                  <Button size="sm" variant="destructive" onClick={() => sendDeleteOtp()} disabled={deleteSendingOtp}>
                    {deleteSendingOtp
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending code…</>
                      : <><Mail className="mr-2 h-4 w-4" />Send confirmation code to {user.email}</>
                    }
                  </Button>
                </div>
              )}

              {/* Step: otp */}
              {deleteStep === "otp" && (
                <div className="space-y-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <button type="button" onClick={() => setDeleteStep("warn")} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </button>

                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-destructive" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enter the code sent to{" "}
                      <span className="font-medium text-foreground">{user.email}</span>
                    </p>
                  </div>

                  <div className="flex gap-1.5 sm:gap-2">
                    {deleteOtp.map((digit, i) => (
                      <Input key={i} ref={(el) => { deleteOtpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={(e) => handleDeleteOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleDeleteOtpKeyDown(i, e)} onPaste={handleDeleteOtpPaste}
                        className="w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-semibold p-0 border-destructive/30"
                      />
                    ))}
                  </div>

                  {deleteError && (
                    <div className="p-2 rounded bg-destructive/10 text-destructive text-sm">{deleteError}</div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="destructive" onClick={handleConfirmDelete}
                      disabled={deleteLoading || !deleteOtp.every(Boolean)}>
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

            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
