"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, SlidersHorizontal, X, Pencil, ArrowUpRight, Copy, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/config/constants";
import type { JobApplication } from "@/types";
import { formatShortDate } from "@/lib/utils/date";
import { STATUS_PRESENTATION } from "./status-picker";
import styles from "./mobile-workspace.module.css";

interface Props {
  application: JobApplication;
  status: ApplicationStatus;
  selected?: boolean;
  selectionMode?: boolean;
  onSelect?: (id: string) => void;
  saving: boolean;
  deleting: boolean;
  duplicating: boolean;
  onSaveStatus: (status: ApplicationStatus) => Promise<boolean>;
  onDuplicate: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

/** A reading surface first. Editing is an explicit action, never a swipe target. */
export function MobileApplicationCard({ application, status, selected, selectionMode, onSelect, saving, deleting, duplicating, onSaveStatus, onDuplicate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(status);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const statusId = useId();
  const manageRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const presentation = STATUS_PRESENTATION[status];
  const busy = saving || deleting || duplicating;

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open]);

  function openManage() {
    setDraftStatus(status);
    setConfirmDelete(false);
    setOpen(true);
  }

  return (
    <div className={styles.mobileOnly}>
      <article data-testid="mobile-application-card" className={`${styles.card} ${selected ? styles.selected : ""} ${deleting ? styles.busy : ""}`}>
        <div className={styles.cardTop}>
          {selectionMode && (
            <label className={styles.selection}>
              <input type="checkbox" checked={!!selected} onChange={() => onSelect?.(application.id)} aria-label={`Select ${application.position} at ${application.company}`} />
            </label>
          )}
          <Link href={`/applications/${application.id}`} className={styles.cardLink}>
            <p className={styles.company}>{application.company}</p>
            <h2 className={styles.role}>{application.position}</h2>
            <div className={styles.meta}>
              {application.location && <span><MapPin aria-hidden="true" />{application.location}</span>}
              <span><CalendarDays aria-hidden="true" />Applied {formatShortDate(application.applied_date)}</span>
            </div>
          </Link>
        </div>
        <div className={styles.cardFooter}>
          <span className={`${styles.status} ${presentation.badge}`}>
            <span className={`${styles.statusDot} ${presentation.dot}`} aria-hidden="true" />{status}
          </span>
          {!selectionMode && (
            <button ref={manageRef} type="button" className={styles.manage} onClick={openManage} aria-label={`Manage ${application.position} at ${application.company}`}>
              <SlidersHorizontal size={14} aria-hidden="true" />Manage
            </button>
          )}
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={styles.sheet} showClose={false} data-mobile-sheet="application-actions"
          onOpenAutoFocus={(event) => { event.preventDefault(); closeRef.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={(event) => { event.preventDefault(); manageRef.current?.focus({ preventScroll: true }); }}>
          <div className={styles.sheetHeader}>
            <div>
              <DialogTitle className={styles.sheetTitle}>{application.position}</DialogTitle>
              <DialogDescription className={styles.sheetDescription}>{application.company}</DialogDescription>
            </div>
            <button ref={closeRef} type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close application actions"><X size={20} /></button>
          </div>

          <form onSubmit={async (event) => {
            event.preventDefault();
            if (!busy && draftStatus !== status && await onSaveStatus(draftStatus)) setOpen(false);
          }}>
            <label className={styles.field} htmlFor={statusId}>
              Application status
              <select id={statusId} value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as ApplicationStatus)} disabled={busy}>
                {APPLICATION_STATUSES.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <div className={styles.sheetActions}>
              <button type="submit" className={styles.primary} disabled={busy || draftStatus === status}>
                {saving && <Loader2 size={16} className="animate-spin" />} {saving ? "Saving…" : "Save status"}
              </button>
            </div>
          </form>

          <div className={styles.actionLinks}>
            <Link href={`/applications/${application.id}/edit`}><Pencil size={17} />Edit application</Link>
            <Link href={`/applications/${application.id}`}><ArrowUpRight size={17} />View details</Link>
            {application.job_url && <a href={application.job_url} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={17} />Open job posting</a>}
          </div>

          <details className={styles.moreActions}>
            <summary>More actions</summary>
            <button type="button" disabled={busy} onClick={async () => { if (await onDuplicate()) setOpen(false); }}>
              {duplicating ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}Duplicate application
            </button>
            {confirmDelete ? (
              <div className={styles.confirmDelete}>
                <p>Delete this application and its tracking history?</p>
                <div>
                  <button type="button" className={styles.danger} disabled={busy} onClick={async () => { if (await onDelete()) setOpen(false); }}>Delete application</button>
                  <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Keep application</button>
                </div>
              </div>
            ) : <button type="button" disabled={busy} className={styles.danger} onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Delete application</button>}
          </details>
        </DialogContent>
      </Dialog>
    </div>
  );
}
