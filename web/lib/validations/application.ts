import { z } from "zod";
import { APPLICATION_STATUSES, APPLICATION_SOURCES, APPLICATION_PROVIDERS } from "@/config";

/**
 * Shared secure URL field for Zod schemas.
 * - Strips null bytes before validation
 * - Rejects javascript:, data:, vbscript:, file: schemes
 * - Allows URLs of any practical length (2083 chars is the DB safety floor, not a UX cap)
 */
export const secureUrlField = z
  .string()
  .transform((v) => v.replace(/[\0\r\n]/g, "").trim())
  .pipe(
    z
      .string()
      .max(2083, "URL exceeds maximum allowed length")
      .refine((v) => {
        if (!v) return true;
        const lower = v.toLowerCase();
        return !["javascript:", "data:", "vbscript:", "file:", "blob:"].some((s) =>
          lower.startsWith(s)
        );
      }, "URL scheme not allowed")
      .refine((v) => {
        if (!v) return true;
        try { new URL(v); return true; } catch { return false; }
      }, "Please enter a valid URL (must start with https://)")
  )
  .optional()
  .or(z.literal(""));

// Schema for creating/updating a job application
export const applicationSchema = z.object({
  company: z
    .string()
    .min(1, "Company name is required")
    .max(255, "Company name is too long")
    .trim(),
  position: z
    .string()
    .min(1, "Position is required")
    .max(255, "Position is too long")
    .trim(),
  status: z.enum(APPLICATION_STATUSES, {
    message: "Please select a valid status",
  }),
  applied_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  job_id: z
    .string()
    .max(100, "Job ID is too long")
    .optional()
    .or(z.literal("")),
  job_url: secureUrlField,
  salary_range: z
    .string()
    .max(100, "Salary range is too long")
    .optional()
    .or(z.literal("")),
  location: z
    .string()
    .max(255, "Location is too long")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(50000, "Notes cannot exceed 50 000 characters")
    .optional()
    .or(z.literal("")),
  job_description: z
    .string()
    .max(20000, "Job description is too long")
    .optional()
    .or(z.literal("")),
  source: z
    .enum(APPLICATION_SOURCES, { message: "Please select a valid source" })
    .optional()
    .or(z.literal("")),
  ats_provider: z
    .enum(APPLICATION_PROVIDERS, { message: "Please select a valid provider" })
    .optional()
    .or(z.literal("")),
  requires_sponsorship: z.boolean().optional().default(false),
});

export type ApplicationFormData = z.infer<typeof applicationSchema>;

// Schema for search/filter
const SEARCH_STATUSES = ["all", ...APPLICATION_STATUSES] as const;

export const searchSchema = z.object({
  query: z.string().max(100).optional(),
  status: z.enum(SEARCH_STATUSES).optional(),
});

export type SearchFormData = z.infer<typeof searchSchema>;

// Re-export auth schemas for backwards compatibility
export {
  loginFormSchema as loginSchema,
  signupFormSchema as signupSchema,
  type LoginFormData,
  type SignupFormData,
} from "./auth";
