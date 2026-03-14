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
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  Applied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  "Phone Screen": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  Interview: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  Offer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;
