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
  location: z.string().trim().max(255).optional().describe("Known job location and work arrangement, such as Remote, Hybrid, or On-site."),
  notes: z.string().trim().max(5000).optional().describe("Useful application details without dedicated fields, such as employment type, weekly hours, deadline, recruiter, team, benefits, work authorization or no-sponsorship statement, and application context. Do not include a resume, credentials, or unrelated personal information."),
  job_description: z.string().trim().min(1).max(20000).describe("Required for every save. Use the complete job-description text available anywhere in the conversation, even if it appeared earlier for resume tailoring. If the original posting text is unavailable, create a detailed factual description using only known conversation details and begin it with 'Generated from conversation:'. Preserve known responsibilities, qualifications, skills, experience, education, benefits, employment type, schedule, and employer details. Maximum 20,000 characters; never fabricate missing facts."),
  source: z.enum(APPLICATION_SOURCES).optional().describe("Where the job was found, if known. ChatGPT is the saving tool, not the job source."),
  ats_provider: z.enum(APPLICATION_PROVIDERS).optional().describe("The application portal used, if it matches one of the supported values. This can differ from the source where the job was found."),
  requires_sponsorship: z.boolean().optional().describe("Whether the user would require visa sponsorship for this role. Include only when explicitly known from the conversation."),
  company_tier: z.enum(COMPANY_TIERS as [string, ...string[]]).optional().describe("The user's company tier classification. Include only when the user explicitly stated or assigned it; do not guess prestige."),
  glassdoor_rating: z.number().min(1).max(5).multipleOf(0.1).optional().describe("A 1.0 to 5.0 company rating explicitly provided by the user or quoted from Glassdoor. Never estimate it."),
}).strict();

export type ChatGptApplication = z.infer<typeof chatGptApplicationSchema>;

export function getChatGptInputSchema() {
  return z.toJSONSchema(chatGptApplicationSchema, { io: "input" });
}
