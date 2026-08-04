"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui";
import type { Contact, JobApplication, Referral, ReferralStatus } from "@/types";

const REFERRAL_STATUSES: ReferralStatus[] = ["Requested", "Submitted", "Pending", "Converted"];

interface ReferralFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (referral: Referral) => void;
  contacts: Contact[];
  applications: Pick<JobApplication, "id" | "company" | "position">[];
  existing?: Referral;
}

export function ReferralForm({ open, onClose, onSaved, contacts, applications, existing }: ReferralFormProps) {
  const [contactId,     setContactId]     = useState(existing?.contact_id ?? "");
  const [applicationId, setApplicationId] = useState(existing?.application_id ?? "");
  const [status,        setStatus]        = useState<ReferralStatus>(existing?.status ?? "Requested");
  const [referralDate,  setReferralDate]  = useState(existing?.referral_date ?? "");
  const [notes,         setNotes]         = useState(existing?.notes ?? "");
  const [saving,        setSaving]        = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const isEdit = !!existing?.id;
      const url    = isEdit ? `/api/networking/referrals/${existing.id}` : "/api/networking/referrals";
      const res    = await fetch(url, {
        method:  isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id:     contactId     || null,
          application_id: applicationId || null,
          status,
          referral_date:  referralDate  || null,
          notes:          notes         || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save.");
      onSaved(json.referral);
      toast.success(isEdit ? "Referral updated." : "Referral added.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save referral.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="db-headline">{existing ? "Edit Referral" : "Add Referral"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Contact picker */}
          <div className="space-y-1.5">
            <Label htmlFor="ref-contact">Contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger id="ref-contact">
                <SelectValue placeholder="Select a contact…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.company ? ` · ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Application picker */}
          <div className="space-y-1.5">
            <Label htmlFor="ref-app">Application</Label>
            <Select value={applicationId} onValueChange={setApplicationId}>
              <SelectTrigger id="ref-app">
                <SelectValue placeholder="Link to application…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {applications.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.position} @ {a.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="ref-status">Referral Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ReferralStatus)}>
              <SelectTrigger id="ref-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFERRAL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Referral date */}
          <div className="space-y-1.5">
            <Label htmlFor="ref-date">Referral Date</Label>
            <Input
              id="ref-date"
              type="date"
              value={referralDate}
              onChange={(e) => setReferralDate(e.target.value)}
              className="text-[16px] sm:text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ref-notes">Notes</Label>
            <Textarea
              id="ref-notes"
              placeholder="Any context about this referral…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              className="text-[16px] sm:text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : existing ? "Save Changes" : "Add Referral"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
