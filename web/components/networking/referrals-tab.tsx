"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, GitMerge, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import type { Contact, JobApplication, Referral, ReferralStatus } from "@/types";
import { ReferralForm } from "./referral-form";
import { formatDate } from "@/lib/utils/date";

const STATUS_STYLE: Record<ReferralStatus, string> = {
  Requested:  "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Submitted:  "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Pending:    "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  Converted:  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

interface ReferralsTabProps {
  initialReferrals: Referral[];
  contacts: Contact[];
  applications: Pick<JobApplication, "id" | "company" | "position">[];
}

export function ReferralsTab({ initialReferrals, contacts, applications }: ReferralsTabProps) {
  const [referrals,  setReferrals]  = useState<Referral[]>(initialReferrals);
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState<Referral | undefined>();
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function handleSaved(r: Referral) {
    setReferrals((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = r; return next; }
      return [r, ...prev];
    });
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/networking/referrals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setReferrals((prev) => prev.filter((r) => r.id !== id));
      toast.success("Referral deleted.");
    } catch {
      toast.error("Failed to delete referral.");
    } finally {
      setDeleting(null);
      setConfirmDel(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="db-headline text-lg">Referral Tracker</h2>
          <p className="text-sm text-[#7a5c52] dark:text-[#b08070]">
            Track referrals from contacts to your job applications.
          </p>
        </div>
        <Button
          onClick={() => { setEditing(undefined); setFormOpen(true); }}
          className="flex-shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Referral
        </Button>
      </div>

      {/* Analytics strip */}
      {referrals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["Requested", "Submitted", "Pending", "Converted"] as ReferralStatus[]).map((s) => {
            const count = referrals.filter((r) => r.status === s).length;
            return (
              <div key={s} className="db-content-card text-center py-3">
                <p className="text-2xl font-bold text-[#3d2b23] dark:text-[#e8d5cc]">{count}</p>
                <p className="text-xs text-[#7a5c52] dark:text-[#b08070] mt-0.5">{s}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Referral list */}
      {referrals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#99462a]/10 dark:bg-[#99462a]/20 flex items-center justify-center">
            <GitMerge className="h-7 w-7 text-[#99462a]" />
          </div>
          <div>
            <p className="font-semibold text-[#3d2b23] dark:text-[#e8d5cc]">No referrals yet</p>
            <p className="text-sm text-[#7a5c52] dark:text-[#b08070] mt-1">
              Add a referral to track which contacts are helping with your applications.
            </p>
          </div>
          <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add First Referral
          </Button>
        </div>
      ) : (
        <div className="db-content-card divide-y divide-[#e8ddd8] dark:divide-[#2a1a10]">
          {referrals.map((r) => (
            <div key={r.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
              {/* Status badge */}
              <span className={`mt-0.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold flex-shrink-0 ${STATUS_STYLE[r.status]}`}>
                {r.status}
              </span>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.contact && (
                    <span className="font-semibold text-sm text-[#3d2b23] dark:text-[#e8d5cc]">
                      {r.contact.name}
                    </span>
                  )}
                  {r.application && (
                    <>
                      <span className="text-[#7a5c52] dark:text-[#b08070] text-sm">→</span>
                      <span className="text-sm text-[#55433d] dark:text-[#c9a99a]">
                        {r.application.position} @ {r.application.company}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[#7a5c52] dark:text-[#b08070]">
                  {r.referral_date && <span>{formatDate(r.referral_date)}</span>}
                  {r.notes && <span className="truncate max-w-[200px]">{r.notes}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {confirmDel === r.id ? (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting === r.id}
                      className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline disabled:opacity-60"
                    >
                      {deleting === r.id ? "Deleting…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmDel(null)}
                      className="text-xs text-[#7a5c52] dark:text-[#b08070] hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditing(r); setFormOpen(true); }}
                      className="h-8 w-8 flex items-center justify-center rounded text-[#7a5c52] dark:text-[#b08070] hover:text-[#99462a] dark:hover:text-[#d97757] transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDel(r.id)}
                      className="h-8 w-8 flex items-center justify-center rounded text-[#7a5c52] dark:text-[#b08070] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* key forces remount when switching between records so useState resets */}
      <ReferralForm
        key={editing?.id ?? "new-referral"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        contacts={contacts}
        applications={applications}
        existing={editing}
      />
    </div>
  );
}
