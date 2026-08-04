"use client";

import { useState, useMemo } from "react";
import { Users, GitMerge, Coffee } from "lucide-react";
import type { Contact, JobApplication, Referral, CoffeeChat } from "@/types";
import { OutreachTab } from "./outreach-tab";
import { ReferralsTab } from "./referrals-tab";
import { CoffeeChatsTab } from "./coffee-chats-tab";

type Tab = "outreach" | "referrals" | "chats";

const TABS: { id: Tab; label: string; icon: React.ElementType; short: string }[] = [
  { id: "outreach",  label: "Outreach",     icon: Users,     short: "Outreach" },
  { id: "referrals", label: "Referrals",    icon: GitMerge,  short: "Referrals" },
  { id: "chats",     label: "Coffee Chats", icon: Coffee,    short: "Chats" },
];

// Computes Monday 00:00:00 in the browser's local timezone as an ISO string.
// Must run client-side so it reflects the user's timezone, not the server's UTC.
function localIsoWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const daysBack = day === 0 ? 6 : day - 1; // days back to Monday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack);
  return monday.toISOString();
}

interface NetworkingHubProps {
  contacts: Contact[];
  referrals: Referral[];
  chats: CoffeeChat[];
  applications: Pick<JobApplication, "id" | "company" | "position">[];
  userSchools: string[];
  initialGoal: number;
}

export function NetworkingHub({
  contacts,
  referrals,
  chats,
  applications,
  userSchools,
  initialGoal,
}: NetworkingHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>("outreach");

  // Computed client-side so it uses the browser's local timezone.
  const thisWeekCount = useMemo(() => {
    const weekStart = localIsoWeekStart();
    return contacts.filter(
      (c) => c.last_contacted_at != null && c.last_contacted_at >= weekStart,
    ).length;
  }, [contacts]);

  return (
    <div>
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="db-content-card text-center py-3">
          <p className="text-2xl font-bold text-[#3d2b23] dark:text-[#e8d5cc]">{contacts.length}</p>
          <p className="text-xs text-[#7a5c52] dark:text-[#b08070] mt-0.5">Contacts</p>
        </div>
        <div className="db-content-card text-center py-3">
          <p className="text-2xl font-bold text-[#3d2b23] dark:text-[#e8d5cc]">{referrals.filter((r) => r.status === "Converted").length}</p>
          <p className="text-xs text-[#7a5c52] dark:text-[#b08070] mt-0.5">Referrals Converted</p>
        </div>
        <div className="db-content-card text-center py-3">
          <p className="text-2xl font-bold text-[#3d2b23] dark:text-[#e8d5cc]">{chats.filter((c) => c.status === "Scheduled").length}</p>
          <p className="text-xs text-[#7a5c52] dark:text-[#b08070] mt-0.5">Chats Upcoming</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="db-filter-bar mb-6">
        <div className="db-filter-pills">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`db-filter-pill flex items-center gap-1.5 ${activeTab === tab.id ? "db-filter-pill-active" : "db-filter-pill-inactive"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "outreach" && (
        <OutreachTab
          initialContacts={contacts}
          userSchools={userSchools}
          initialGoal={initialGoal}
          thisWeekCount={thisWeekCount}
        />
      )}
      {activeTab === "referrals" && (
        <ReferralsTab
          initialReferrals={referrals}
          contacts={contacts}
          applications={applications}
        />
      )}
      {activeTab === "chats" && (
        <CoffeeChatsTab
          initialChats={chats}
          contacts={contacts}
        />
      )}
    </div>
  );
}
