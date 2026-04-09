export const APP_NAME = "Jobnest";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  DASHBOARD: "/dashboard",
  APPLICATIONS: "/applications",
  APPLICATION_NEW: "/applications/new",
  APPLICATION_DETAIL: (id: string) => `/applications/${id}`,
  APPLICATION_EDIT: (id: string) => `/applications/${id}/edit`,
  INTERVIEWS: "/interviews",
  CONTACTS: "/contacts",
  TEMPLATES: "/templates",
  REMINDERS: "/reminders",
} as const;

export const APPLICATION_STATUSES = [
  "Applied",
  "Phone Screen",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Ghosted",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  Applied: "bg-blue-100 text-blue-800",
  "Phone Screen": "bg-yellow-100 text-yellow-800",
  Interview: "bg-purple-100 text-purple-800",
  Offer: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Withdrawn: "bg-slate-100 text-slate-600",
  Ghosted: "bg-zinc-100 text-zinc-500",
};

export const APPLICATION_SOURCES = [
  "LinkedIn",
  "LinkedIn Easy Apply",
  "Indeed",
  "Company Website",
  "Referral",
  "Recruiter Outreach",
  "Handshake",
  "Wellfound",
  "Dice",
  "Job Fair",
  "Other",
] as const;

export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const WORK_AUTHORIZATION_OPTIONS = [
  "US Citizen",
  "Green Card",
  "H1B",
  "OPT (F-1)",
  "CPT",
  "TN Visa",
  "EAD (Other)",
  "Not Applicable",
] as const;

export type WorkAuthorization = (typeof WORK_AUTHORIZATION_OPTIONS)[number];

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;
