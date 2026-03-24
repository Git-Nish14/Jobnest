import { z } from "zod";

// Contact form API schema
export const contactApiSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long")
    .trim(),
  email: z
    .string()
    .email("Please enter a valid email address")
    .max(255, "Email is too long")
    .toLowerCase()
    .trim(),
  subject: z
    .string()
    .min(5, "Subject must be at least 5 characters")
    .max(200, "Subject is too long")
    .trim(),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message is too long")
    .trim(),
});

// NESTAi API schema
export const nestaAiSchema = z.object({
  question: z
    .string()
    .min(1, "Question is required")
    .max(2000, "Question is too long")
    .trim(),
  fileContent: z
    .string()
    .max(15000, "Attached file content is too large")
    .optional(),
  fileName: z.string().max(255).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(10000),
      })
    )
    .max(200)
    .optional()
    .default([]),
});

// Document path validation
export const documentPathSchema = z.object({
  path: z
    .string()
    .min(1, "Path is required")
    .regex(
      /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-zA-Z0-9_-]+\.[a-z]+$/,
      "Invalid document path format"
    ),
});

// Export data format schema
export const exportSchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
  includeNotes: z.coerce.boolean().default(false),
  statuses: z
    .string()
    .optional()
    .transform((val) => val?.split(",").filter(Boolean) || []),
});

// Chat session schemas
export const createChatSessionSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title is too long")
    .trim()
    .optional()
    .default("New Chat"),
});

export const updateChatSessionSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title is too long")
    .trim()
    .optional(),
  is_pinned: z.boolean().optional(),
}).refine((d) => d.title !== undefined || d.is_pinned !== undefined, {
  message: "Provide at least title or is_pinned",
});

export const createChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .min(1, "Content is required")
    .max(50000, "Content is too long")
    .trim(),
  metadata: z
    .object({
      attachment: z
        .object({
          name: z.string().max(255),
          fileType: z.string().max(10),
          preview: z.string().max(3000).optional(), // first 3000 chars for in-chat viewing
        })
        .optional(),
    })
    .optional(),
});

// Export types
export type ContactApiInput = z.infer<typeof contactApiSchema>;
export type NestaAiInput = z.infer<typeof nestaAiSchema>;
export type NestaAiHistoryItem = NestaAiInput["history"][number];
export type DocumentPathInput = z.infer<typeof documentPathSchema>;
export type ExportInput = z.infer<typeof exportSchema>;
export type CreateChatSessionInput = z.infer<typeof createChatSessionSchema>;
export type UpdateChatSessionInput = z.infer<typeof updateChatSessionSchema>;
export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>;
