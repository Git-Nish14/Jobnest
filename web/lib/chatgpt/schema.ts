import { z } from "zod";
import { APPLICATION_SOURCES, APPLICATION_STATUSES } from "@/config/constants";

// Keep the tool's published JSON schema and server validation in one place.
export const chatGptApplicationSchema = z.object({
  request_id: z.string().trim().min(1).max(100).describe("A unique identifier for this save. Reuse it with identical arguments when retrying the same save."),
  company: z.string().trim().min(1).max(255).describe("Employer name from the conversation."),
  position: z.string().trim().min(1).max(255).describe("Job title from the conversation."),
  applied_date: z.iso.date().describe("Actual application date, YYYY-MM-DD. Ask if unknown; tailoring a resume does not mean the user applied."),
  status: z.enum(APPLICATION_STATUSES).default("Applied"),
  job_id: z.string().trim().max(100).optional(),
  job_url: z.string().trim().max(2083).url().refine((value) => /^https?:\/\//i.test(value), "Only HTTP or HTTPS job URLs are allowed.").optional(),
  salary_range: z.string().trim().max(100).optional(),
  location: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(5000).optional().describe("Optional job-specific notes. Do not include a resume or unrelated personal information."),
  job_description: z.string().trim().max(20000).optional(),
  source: z.enum(APPLICATION_SOURCES).optional().describe("Where the job was found, if known. ChatGPT is the saving tool, not the job source."),
}).strict();

export type ChatGptApplication = z.infer<typeof chatGptApplicationSchema>;

export function getChatGptInputSchema() {
  return z.toJSONSchema(chatGptApplicationSchema, { io: "input" });
}
