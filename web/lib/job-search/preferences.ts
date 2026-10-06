import { z } from "zod";

export const searchPreferencesSchema = z.object({
  weeklyMinutes: z.number().int().min(0).max(10080).default(300),
  applicationMinutes: z.number().int().min(5).max(240).default(30),
  preferredDays: z.array(z.number().int().min(0).max(6)).min(1).max(7)
    .refine((days) => new Set(days).size === days.length, "Choose each day once")
    .default([1, 2, 3, 4, 5]),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(0),
  paused: z.boolean().default(false),
}).strict();

export type SearchPreferences = z.infer<typeof searchPreferencesSchema>;

export function readSearchPreferences(value: unknown): SearchPreferences {
  const result = searchPreferencesSchema.safeParse(value);
  return result.success ? result.data : searchPreferencesSchema.parse({});
}

export function readWeeklyGoal(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100 ? value : 5;
}
