"use client";

import { useState } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { Button } from "@/components/ui";

interface DeletionBannerProps {
  scheduledDeletionAt: string;
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function DeletionBanner({ scheduledDeletionAt }: DeletionBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  const days = daysUntil(scheduledDeletionAt);
  const date = formatDate(scheduledDeletionAt);

  const handleReactivate = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithRetry("/api/profile/reactivate-account", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reactivate account");
        return;
      }
      // Refresh the page to remove the banner
      router.refresh();
    } catch {
      setError("Failed to reactivate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-destructive/10 border-b border-destructive/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-start gap-3 sm:items-center">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              Your account is scheduled for permanent deletion in{" "}
              <strong>{days} day{days === 1 ? "" : "s"}</strong> ({date}).
            </p>
            {error && (
              <p className="text-xs text-destructive mt-0.5">{error}</p>
            )}
            <p className="text-xs text-destructive/80 mt-0.5 hidden sm:block">
              All your data will be permanently removed. Sign in within the grace period to cancel.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleReactivate}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Cancel Deletion
            </Button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
