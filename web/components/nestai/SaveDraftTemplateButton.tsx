"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { BookmarkPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from "@/components/ui";
import { TEMPLATE_CATEGORIES } from "@/lib/validations/forms";

export function SaveDraftTemplateButton({ content }: { content: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const submitting = useRef(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fields = new FormData(event.currentTarget);
    const input = Object.fromEntries(["name", "subject", "category", "body"].map(key => [key, String(fields.get(key) ?? "").trim()]));
    if (!input.name || !input.subject || !input.body) { setError("Enter a name, subject, and email body."); return; }
    submitting.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/nesta-ai/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the template.");
      setSaved(true);
      toast.success("Saved to your email templates");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the template."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <>
    <button type="button" onClick={() => { setOpen(true); setSaved(false); setError(""); }} className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Save response as email template">
      <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" /> Save as template
    </button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Save email template</DialogTitle><DialogDescription>Review and personalize this draft before adding it to your library. This does not send an email.</DialogDescription></DialogHeader>
        {saved ? <div role="status" className="space-y-4 py-3"><p className="text-sm">Your template is ready to reuse.</p><Button asChild><Link href="/templates">View templates</Link></Button><Button variant="outline" onClick={() => setOpen(false)} className="ml-2">Done</Button></div> : <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor={`${id}-name`}>Template name</Label><Input id={`${id}-name`} name="name" maxLength={100} required placeholder="For example, interview follow-up" disabled={busy} /></div>
          <div className="space-y-1.5"><Label htmlFor={`${id}-subject`}>Email subject</Label><Input id={`${id}-subject`} name="subject" maxLength={255} required disabled={busy} /></div>
          <div className="space-y-1.5"><Label htmlFor={`${id}-category`}>Category</Label><select id={`${id}-category`} name="category" defaultValue="General" disabled={busy} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{TEMPLATE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor={`${id}-body`}>Email body</Label><Textarea id={`${id}-body`} name="body" defaultValue={content} maxLength={10_000} rows={9} required disabled={busy} /><p className="text-xs text-muted-foreground">Keep placeholders such as [Company] for details you will fill in later.</p></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Save template</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}
