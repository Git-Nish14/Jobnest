// Single source of truth — imported by API routes, Zod schemas, and UI components.
export const OUTREACH_STATUSES = [
  "Not Contacted",
  "Connection Request Sent",
  "Connected",
  "Message Sent",
  "Replied",
  "Coffee Chat Scheduled",
  "Referral Requested",
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export type ReferralStatus = "Requested" | "Submitted" | "Pending" | "Converted";
export type ChatMedium = "Zoom" | "Phone" | "In-person" | "Google Meet" | "Teams";
export type ChatStatus = "Scheduled" | "Completed" | "Cancelled" | "No-show";

export interface Referral {
  id: string;
  user_id: string;
  application_id: string | null;
  contact_id: string | null;
  status: ReferralStatus;
  referral_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contact?: { name: string; title: string | null; company: string | null };
  application?: { company: string; position: string; status: string };
}

export interface ReferralInsert {
  application_id?: string | null;
  contact_id?: string | null;
  status?: ReferralStatus;
  referral_date?: string | null;
  notes?: string | null;
}

export type ReferralUpdate = Partial<ReferralInsert>;

export interface CoffeeChat {
  id: string;
  user_id: string;
  contact_id: string | null;
  scheduled_at: string;
  medium: ChatMedium;
  status: ChatStatus;
  agenda: string | null;
  notes: string | null;
  follow_up_sent: boolean;
  referral_outcome: string | null;
  created_at: string;
  updated_at: string;
  contact?: { name: string; title: string | null; company: string | null };
}

export interface CoffeeChatInsert {
  contact_id?: string | null;
  scheduled_at: string;
  medium?: ChatMedium;
  status?: ChatStatus;
  agenda?: string | null;
  notes?: string | null;
  follow_up_sent?: boolean;
  referral_outcome?: string | null;
}

export type CoffeeChatUpdate = Partial<CoffeeChatInsert>;
