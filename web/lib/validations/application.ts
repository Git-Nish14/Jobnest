import { z } from "zod";

export const APPLICATION_STATUSES = [
  "Applied",
  "Phone Screen",
  "Interview",
  "Offer",
  "Rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

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
  job_url: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
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
    .max(5000, "Notes are too long")
    .optional()
    .or(z.literal("")),
});

export type ApplicationFormData = z.infer<typeof applicationSchema>;

// Schema for login
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Schema for signup
export const signupSchema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address"),
    password: z
      .string()
      .min(1, "Password is required")
      .min(6, "Password must be at least 6 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignupFormData = z.infer<typeof signupSchema>;

// Schema for search/filter
const SEARCH_STATUSES = ["all", ...APPLICATION_STATUSES] as const;

export const searchSchema = z.object({
  query: z.string().max(100).optional(),
  status: z.enum(SEARCH_STATUSES).optional(),
});

export type SearchFormData = z.infer<typeof searchSchema>;
