import { z } from "zod";

// Interview types and statuses
export const INTERVIEW_TYPES = [
  "Phone Screen",
  "Technical",
  "Behavioral",
  "On-site",
  "Panel",
  "Final",
  "Other",
] as const;

export const INTERVIEW_STATUSES = [
  "Scheduled",
  "Completed",
  "Cancelled",
  "Rescheduled",
  "No Show",
] as const;

// Reminder types
export const REMINDER_TYPES = ["Follow Up", "Interview", "Deadline", "Custom"] as const;

// Template categories
export const TEMPLATE_CATEGORIES = [
  "Follow Up",
  "Thank You",
  "Offer",
  "General",
  "Networking",
] as const;

// Interview form schema
export const interviewSchema = z.object({
  type: z.enum(INTERVIEW_TYPES, {
    message: "Please select a valid interview type",
  }),
  status: z.enum(INTERVIEW_STATUSES, {
    message: "Please select a valid status",
  }),
  round: z.coerce.number().int().min(1, "Round must be at least 1").max(20, "Round cannot exceed 20"),
  scheduled_at: z
    .string()
    .min(1, "Date and time is required")
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date format"),
  duration_minutes: z.coerce
    .number()
    .int()
    .min(15, "Duration must be at least 15 minutes")
    .max(480, "Duration cannot exceed 8 hours"),
  location: z
    .string()
    .max(255, "Location is too long")
    .optional()
    .or(z.literal("")),
  meeting_url: z
    .string()
    .url("Please enter a valid URL")
    .max(500, "URL is too long")
    .optional()
    .or(z.literal("")),
  interviewer_names: z
    .string()
    .max(500, "Interviewer names are too long")
    .optional()
    .or(z.literal("")),
  preparation_notes: z
    .string()
    .max(5000, "Notes are too long")
    .optional()
    .or(z.literal("")),
  post_interview_notes: z
    .string()
    .max(5000, "Notes are too long")
    .optional()
    .or(z.literal("")),
});

// Reminder form schema
export const reminderSchema = z.object({
  type: z.enum(REMINDER_TYPES, {
    message: "Please select a valid reminder type",
  }),
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title is too long")
    .trim(),
  description: z
    .string()
    .max(1000, "Description is too long")
    .optional()
    .or(z.literal("")),
  remind_at: z
    .string()
    .min(1, "Reminder date is required")
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date format"),
});

// Contact form schema
export const contactFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name is too long")
    .trim(),
  title: z
    .string()
    .max(100, "Title is too long")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Please enter a valid email")
    .max(255, "Email is too long")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30, "Phone number is too long")
    .optional()
    .or(z.literal("")),
  linkedin_url: z
    .string()
    .url("Please enter a valid URL")
    .max(500, "URL is too long")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(2000, "Notes are too long")
    .optional()
    .or(z.literal("")),
  is_primary: z.boolean().default(false),
});

// Email template form schema
export const templateSchema = z.object({
  name: z
    .string()
    .min(1, "Template name is required")
    .max(100, "Name is too long")
    .trim(),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(255, "Subject is too long")
    .trim(),
  body: z
    .string()
    .min(1, "Email body is required")
    .max(10000, "Body is too long"),
  category: z.enum(TEMPLATE_CATEGORIES, {
    message: "Please select a valid category",
  }),
});

// Export types
export type InterviewFormData = z.infer<typeof interviewSchema>;
export type ReminderFormData = z.infer<typeof reminderSchema>;
export type ContactFormData = z.infer<typeof contactFormSchema>;
export type TemplateFormData = z.infer<typeof templateSchema>;
