import { z } from "zod";
import { APPLICATION_PROVIDERS, APPLICATION_SOURCES, APPLICATION_STATUSES } from "@/config/constants";
import { COMPANY_TIERS } from "@/types/application";

// Keep the tool's published JSON schema and server validation in one place.
export const chatGptApplicationSchema = z.object({
  request_id: z.string().trim().min(1).max(100).describe("A unique identifier for this save. Reuse it with identical arguments when retrying the same save."),
  company: z.string().trim().min(1).max(255).describe("Employer name from the conversation."),
  position: z.string().trim().min(1).max(255).describe("Job title from the conversation."),
  applied_date: z.iso.date().default(() => new Date().toISOString().slice(0, 10)).describe("Application date in YYYY-MM-DD. When the user says JOBNEST, use today's date automatically unless the conversation explicitly gives another application date. Do not ask for the date."),
  status: z.enum(APPLICATION_STATUSES).default("Applied"),
  job_id: z.string().trim().max(100).optional().describe("The employer requisition or posting ID, if shown."),
  job_url: z.string().trim().max(2083).url().refine((value) => /^https?:\/\//i.test(value), "Only HTTP or HTTPS job URLs are allowed.")
    .describe("Required for every save. Use the plain HTTP or HTTPS job-posting URL from anywhere in the conversation. If it is unavailable, ask the user to provide it before saving. Send the URL itself, never Markdown link syntax."),
  salary_range: z.string().trim().max(100).optional().describe("Compensation exactly as known, including currency and hourly, monthly, or yearly cadence."),
  location: z.string().trim().min(1).max(255).describe("Required for duplicate checking. Use the job location and work arrangement, such as Remote, Hybrid, or On-site. Research it after JOBNEST and ask the user if it remains unknown."),
  notes: z.string().trim().max(5000).optional().describe("Useful application details without dedicated fields, such as employment type, weekly hours, deadline, recruiter, team, benefits, work authorization or no-sponsorship statement, and application context. Do not include a resume, credentials, or unrelated personal information."),
  job_description: z.string().trim().min(1).max(20000).describe("Required for every save. Use the complete job-description text available in the conversation or researched from the exact posting URL, even if it appeared earlier for resume tailoring. If original posting text remains unavailable, create a detailed factual description using only verified conversation and research details and begin it with 'Generated from available information:'. Preserve known responsibilities, qualifications, skills, experience, education, benefits, employment type, schedule, and employer details. Maximum 20,000 characters; never fabricate missing facts."),
  source: z.enum(APPLICATION_SOURCES).optional().describe("Where the job was found, if known. ChatGPT is the saving tool, not the job source."),
  ats_provider: z.enum(APPLICATION_PROVIDERS).optional().describe("The application portal used, if it matches one of the supported values. This can differ from the source where the job was found."),
  requires_sponsorship: z.boolean().optional().describe("Set true only when the exact posting or other verified evidence says this role does not sponsor visas or otherwise requires the user to supply work authorization; set false when sponsorship is available or no such restriction is known."),
  company_tier: z.enum(COMPANY_TIERS as [string, ...string[]]).optional().describe("Company classification. Use a user-provided value or reliable researched company facts; omit it when the classification is uncertain and never guess prestige."),
  glassdoor_rating: z.number().min(1).max(5).multipleOf(0.1).optional().describe("A 1.0 to 5.0 company rating explicitly provided by the user or quoted from Glassdoor. Never estimate it."),
}).strict();

export type ChatGptApplication = z.infer<typeof chatGptApplicationSchema>;

export const chatGptDuplicateCheckSchema = z.object({
  company: z.string().trim().min(1).max(255).describe("Exact employer name for the job being considered."),
  position: z.string().trim().min(1).max(255).describe("Exact job title for the job being considered."),
  location: z.string().trim().min(1).max(255).describe("Job location and work arrangement. Research it first when possible; ask the user if it remains unknown."),
}).strict();

export type ChatGptDuplicateCheck = z.infer<typeof chatGptDuplicateCheckSchema>;

export function getChatGptInputSchema() {
  return z.toJSONSchema(chatGptApplicationSchema, { io: "input" });
}

export function getChatGptDuplicateCheckInputSchema() {
  return z.toJSONSchema(chatGptDuplicateCheckSchema, { io: "input" });
}
