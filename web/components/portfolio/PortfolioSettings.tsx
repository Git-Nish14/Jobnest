"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2, Globe, Check, X, Copy, ExternalLink, Eye, EyeOff, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function PortfolioSettings() {
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "reserved">("idle");
  const [portfolioPublic, setPortfolioPublic] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      const meta = user.user_metadata ?? {};
      const uname = meta.username ?? null;
      setCurrentUsername(uname);
      setUsername(uname ?? "");
      setPortfolioPublic(meta.portfolio_public ?? false);
      setShowEmail(meta.show_email ?? false);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const checkAvailability = (val: string) => {
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    if (!val) { setAvailability("idle"); return; }
    if (!USERNAME_RE.test(val)) { setAvailability("invalid"); return; }
    if (val === currentUsername) { setAvailability("available"); return; }

    setAvailability("checking");
    checkTimeoutRef.current = setTimeout(async () => {
      const res = await fetch(`/api/portfolio/username?u=${encodeURIComponent(val)}`);
      if (!res.ok) { setAvailability("idle"); return; }
      const d = await res.json() as { available: boolean; reason?: string };
      if (d.reason === "reserved") setAvailability("reserved");
      else if (d.reason === "invalid_format") setAvailability("invalid");
      else setAvailability(d.available ? "available" : "taken");
    }, 400);
  };

  const saveUsername = async () => {
    if (availability !== "available" && username !== currentUsername) return;
    setSaving(true);
    const res = await fetch("/api/portfolio/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json() as { username: string };
      setCurrentUsername(d.username);
      toast.success("Username saved.");
    } else {
      const d = await res.json() as { error?: string };
      toast.error(d.error ?? "Failed to save username.");
    }
  };

  const togglePublic = async () => {
    setTogglingPublic(true);
    const newVal = !portfolioPublic;
    const res = await fetch("/api/profile/update-portfolio-visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolio_public: newVal }),
    });
    setTogglingPublic(false);
    if (res.ok) {
      setPortfolioPublic(newVal);
      toast.success(newVal ? "Portfolio is now public." : "Portfolio is now private.");
    } else {
      const d = await res.json() as { error?: string };
      toast.error(d.error ?? "Failed to update visibility.");
    }
  };

  const toggleShowEmail = async () => {
    const newVal = !showEmail;
    setShowEmail(newVal);
    const res = await fetch("/api/profile/update-portfolio-visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_email: newVal }),
    });
    if (!res.ok) {
      setShowEmail(!newVal);
      toast.error("Failed to update email setting.");
    }
  };

  const copyUrl = () => {
    if (!currentUsername) return;
    const url = `${appUrl}/p/${currentUsername}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Portfolio URL copied!"));
  };

  const availabilityIcon = () => {
    if (availability === "checking") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (availability === "available") return <Check className="h-4 w-4 text-emerald-500" />;
    if (availability === "taken" || availability === "reserved" || availability === "invalid")
      return <X className="h-4 w-4 text-destructive" />;
    return null;
  };

  const availabilityMessage = () => {
    if (availability === "taken") return <p className="text-xs text-destructive">Username is taken.</p>;
    if (availability === "reserved") return <p className="text-xs text-destructive">This username is reserved.</p>;
    if (availability === "invalid") return <p className="text-xs text-destructive">3–30 chars, lowercase letters, numbers, hyphens only.</p>;
    if (availability === "available" && username !== currentUsername) return <p className="text-xs text-emerald-500">Available!</p>;
    return null;
  };

  return (
    <div className="db-content-card space-y-5">
      <h2 className="db-headline text-lg font-semibold text-foreground flex items-center gap-2">
        <Globe className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" /> Public Portfolio
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Username */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Portfolio Username
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                  /p/
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                    setUsername(v);
                    checkAvailability(v);
                  }}
                  placeholder="your-username"
                  maxLength={30}
                  className={cn(
                    "w-full rounded-lg border bg-muted/30 pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]",
                    availability === "taken" || availability === "reserved" || availability === "invalid"
                      ? "border-destructive"
                      : "border-border"
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {availabilityIcon()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void saveUsername()}
                disabled={saving || !username || (availability !== "available" && username !== currentUsername)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save
              </button>
            </div>
            {availabilityMessage()}
            {currentUsername && (
              <p className="text-xs text-muted-foreground">
                Current: <code className="font-mono">/p/{currentUsername}</code>
              </p>
            )}
          </div>

          {/* Public toggle */}
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                {portfolioPublic
                  ? <><Eye className="h-4 w-4 text-emerald-500" /> Public portfolio</>
                  : <><EyeOff className="h-4 w-4 text-muted-foreground" /> Private portfolio</>
                }
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {portfolioPublic
                  ? "Anyone with the link can see your portfolio."
                  : "Only you can see your portfolio page."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void togglePublic()}
              disabled={togglingPublic || !currentUsername}
              aria-label={portfolioPublic ? "Make private" : "Make public"}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:opacity-50",
                portfolioPublic ? "bg-[#99462a] dark:bg-[#ccff00]" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform",
                  portfolioPublic ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          {/* Show email toggle — gated on portfolio being public */}
          {portfolioPublic && (
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Show email on portfolio
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {showEmail
                    ? "Your account email is visible as a contact link."
                    : "Email is hidden. Visitors cannot see your address."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggleShowEmail()}
                aria-label={showEmail ? "Hide email" : "Show email"}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
                  showEmail ? "bg-[#99462a] dark:bg-[#ccff00]" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform",
                    showEmail ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          )}

          {/* Copy URL + Open */}
          {currentUsername && portfolioPublic && (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted/50 rounded-lg px-3 py-2 text-muted-foreground truncate">
                {appUrl}/p/{currentUsername}
              </code>
              <button
                type="button"
                onClick={copyUrl}
                className="p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Copy portfolio URL"
              >
                <Copy className="h-4 w-4" />
              </button>
              <a
                href={`/p/${currentUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Open portfolio"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}

          {!currentUsername && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              Set a username above to get your public portfolio URL.
            </p>
          )}
        </>
      )}
    </div>
  );
}
