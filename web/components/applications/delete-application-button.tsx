"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  applicationId: string;
}

export function DeleteApplicationButton({ applicationId }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const handleFirstClick = () => {
    setConfirming(true);
    // Auto-cancel after 5 seconds if user doesn't confirm
    setTimeout(() => setConfirming(false), 5000);
  };

  const handleConfirm = async () => {
    setConfirming(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Delete failed");
      }
      toast.success("Application deleted");
      router.push("/applications");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete application");
      setDeleting(false);
    }
  };

  if (deleting) {
    return (
      <button disabled className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground opacity-60">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Deleting…</span>
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="hidden sm:inline text-xs text-muted-foreground">Are you sure?</span>
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-semibold bg-destructive text-white hover:bg-destructive/90 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Yes, delete</span>
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          aria-label="Cancel delete"
          className="inline-flex items-center justify-center h-8 w-8 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">Cancel</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleFirstClick}
      aria-label="Delete application"
      className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
    >
      <Trash2 className="h-4 w-4" />
      <span className="hidden sm:inline">Delete</span>
    </button>
  );
}
