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

export const SOURCE_COLORS: Record<
  string,
  { bg: string; text: string; darkBg: string; darkText: string }
> = {
  "LinkedIn":            { bg: "bg-[#0A66C2]/10", text: "text-[#0A66C2]",  darkBg: "dark:bg-[#0A66C2]/20", darkText: "dark:text-[#4da3ff]" },
  "LinkedIn Easy Apply": { bg: "bg-[#0A66C2]/10", text: "text-[#0A66C2]",  darkBg: "dark:bg-[#0A66C2]/20", darkText: "dark:text-[#4da3ff]" },
  "Indeed":              { bg: "bg-[#003A9B]/10", text: "text-[#003A9B]",  darkBg: "dark:bg-[#003A9B]/20", darkText: "dark:text-[#6ea8fe]" },
  "Glassdoor":           { bg: "bg-[#0CAA41]/10", text: "text-[#0CAA41]",  darkBg: "dark:bg-[#0CAA41]/20", darkText: "dark:text-[#34d058]" },
  "Handshake":           { bg: "bg-[#E8552A]/10", text: "text-[#E8552A]",  darkBg: "dark:bg-[#E8552A]/20", darkText: "dark:text-[#ff8c6b]" },
  "Wellfound":           { bg: "bg-black/8",      text: "text-[#111111]",  darkBg: "dark:bg-white/10",     darkText: "dark:text-white" },
  "Dice":                { bg: "bg-[#EB1C26]/10", text: "text-[#EB1C26]",  darkBg: "dark:bg-[#EB1C26]/20", darkText: "dark:text-[#ff6b6b]" },
  "Recruiter Outreach":  { bg: "bg-amber-500/10", text: "text-amber-700",  darkBg: "dark:bg-amber-500/15", darkText: "dark:text-amber-400" },
  "Referral":            { bg: "bg-violet-500/10",text: "text-violet-700", darkBg: "dark:bg-violet-500/15",darkText: "dark:text-violet-400" },
  "Job Fair":            { bg: "bg-cyan-500/10",  text: "text-cyan-700",   darkBg: "dark:bg-cyan-500/15",  darkText: "dark:text-cyan-400" },
  "Company Website":     { bg: "bg-slate-500/10", text: "text-slate-600",  darkBg: "dark:bg-slate-500/15", darkText: "dark:text-slate-400" },
  "Other":               { bg: "bg-muted/60",     text: "text-muted-foreground/60", darkBg: "", darkText: "" },
};

export const APPLICATION_PROVIDERS = [
  "Workday",
  "Lever",
  "Greenhouse",
  "Ashby",
  "Oracle (Taleo)",
  "SAP SuccessFactors",
  "iCIMS",
  "Jobvite",
  "SmartRecruiters",
  "BambooHR",
  "Rippling",
  "ADP",
  "Recruiting.com",
  "Company Website Portal",
  "Other",
] as const;

export type ApplicationProvider = (typeof APPLICATION_PROVIDERS)[number];

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
