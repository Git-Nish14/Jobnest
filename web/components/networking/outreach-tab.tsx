"use client";

import { useState, useMemo } from "react";
import { Users } from "lucide-react";
import type { Contact, OutreachStatus } from "@/types";
import { ContactOutreachCard } from "./contact-outreach-card";
import { ConnectionGoalWidget } from "./connection-goal-widget";

const PIPELINE_COLUMNS: OutreachStatus[] = [
  "Not Contacted",
  "Connection Request Sent",
  "Connected",
  "Message Sent",
  "Replied",
  "Coffee Chat Scheduled",
  "Referral Requested",
];

interface OutreachTabProps {
  initialContacts: Contact[];
  userSchools: string[];
  initialGoal: number;
  thisWeekCount: number;
}

export function OutreachTab({ initialContacts, userSchools, initialGoal, thisWeekCount }: OutreachTabProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);

  const schoolSet = useMemo(
    () => new Set(userSchools.map((s) => s.toLowerCase())),
    [userSchools],
  );

  function isAlumni(contact: Contact) {
    return !!contact.school && schoolSet.has(contact.school.toLowerCase());
  }

  function handleChange(updated: Contact) {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  // Group contacts by outreach_status
  const byStatus = useMemo(() => {
    const map = new Map<OutreachStatus, Contact[]>();
    for (const col of PIPELINE_COLUMNS) map.set(col, []);
    for (const c of contacts) {
      const s = (c.outreach_status as OutreachStatus) ?? "Not Contacted";
      const bucket = map.get(s) ?? map.get("Not Contacted");
      bucket?.push(c);
    }
    return map;
  }, [contacts]);

  // Suggested contacts: anyone not yet contacted regardless of application linkage.
  // Prioritise those linked to active applications, then alphabetical.
  const suggested = useMemo(
    () => contacts
      .filter((c) => !c.outreach_status || c.outreach_status === "Not Contacted")
      .sort((a, b) => {
        const aLinked = a.application_id ? 0 : 1;
        const bLinked = b.application_id ? 0 : 1;
        if (aLinked !== bLinked) return aLinked - bLinked;
        return a.name.localeCompare(b.name);
      }),
    [contacts],
  );

  const alumniContacts = contacts.filter(isAlumni);

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-[#99462a]/10 dark:bg-[#99462a]/20 flex items-center justify-center">
          <Users className="h-8 w-8 text-[#99462a]" />
        </div>
        <div>
          <p className="font-semibold text-[#3d2b23] dark:text-[#e8d5cc]">No contacts yet</p>
          <p className="text-sm text-[#7a5c52] dark:text-[#b08070] mt-1">
            Add contacts from the{" "}
            <a href="/contacts" className="underline text-[#99462a]">Contacts page</a>{" "}
            to start tracking your outreach pipeline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection goal + alumni stats strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ConnectionGoalWidget
            initialGoal={initialGoal}
            thisWeekCount={thisWeekCount}
            suggestedContacts={suggested}
          />
        </div>

        {/* Alumni highlight card */}
        {alumniContacts.length > 0 && (
          <div className="db-content-card space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎓</span>
              <span className="font-semibold text-sm text-[#55433d] dark:text-[#c9a99a]">
                Alumni Connections ({alumniContacts.length})
              </span>
            </div>
            <p className="text-xs text-[#7a5c52] dark:text-[#b08070]">
              These contacts attended the same school as you — great people to reach out to!
            </p>
            <ul className="space-y-1.5">
              {alumniContacts.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center shrink-0 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-[#3d2b23] dark:text-[#e8d5cc] truncate">{c.name}</span>
                  {c.school && (
                    <span className="text-[#7a5c52] dark:text-[#b08070] text-xs truncate">· {c.school}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Pipeline board */}
      <div>
        <h2 className="db-headline text-lg mb-4">Outreach Pipeline</h2>
        <div className="overflow-x-auto pb-2 -mx-1">
          <div className="flex gap-4 min-w-max px-1">
            {PIPELINE_COLUMNS.map((col) => {
              const colContacts = byStatus.get(col) ?? [];
              return (
                <div key={col} className="flex flex-col gap-3 w-55 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#7a5c52] dark:text-[#b08070] uppercase tracking-wider truncate">
                      {col}
                    </span>
                    <span className="text-xs text-[#7a5c52] dark:text-[#b08070] bg-[#f0ece8] dark:bg-[#2a1a10] rounded-full px-2 py-0.5 shrink-0 ml-1">
                      {colContacts.length}
                    </span>
                  </div>
                  {colContacts.length === 0 ? (
                    <div className="h-20 rounded-xl border border-dashed border-[#dbc1b9]/40 dark:border-[#4a3020]/60 flex items-center justify-center">
                      <span className="text-xs text-[#7a5c52]/50 dark:text-[#b08070]/50">Empty</span>
                    </div>
                  ) : (
                    colContacts.map((c) => (
                      <ContactOutreachCard
                        key={c.id}
                        contact={c}
                        isAlumni={isAlumni(c)}
                        onChange={handleChange}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
