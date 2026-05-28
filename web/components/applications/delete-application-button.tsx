"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
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
      <button disabled className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground opacity-60">
        <Loader2 className="h-4 w-4 animate-spin" />
        Deleting…
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="hidden sm:flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Are you sure?</span>
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-destructive text-white hover:bg-destructive/90 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Yes, delete
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleFirstClick}
      className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </button>
  );
}
