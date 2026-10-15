"use client";

import { useRef, useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "sonner";

export function InterviewCalendarButton({ interviewId }: { interviewId: string }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function download() {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try {
      const response = await fetch(`/api/interviews/${encodeURIComponent(interviewId)}/calendar`, { cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/calendar")) throw new Error("Could not export this interview. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `interview-${interviewId}.ics`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Calendar export failed."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={download}>
    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} Export calendar (.ics)
  </Button>;
}
