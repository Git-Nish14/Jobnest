import { z } from "zod";

export const equitySchema = z.object({
  total_shares: z.number().finite().positive().max(1_000_000_000),
  current_price: z.number().finite().min(0).max(1_000_000),
  grant_date: z.iso.date(),
  cliff_months: z.number().int().min(0).max(120),
  vest_months: z.number().int().min(1).max(120),
}).strict().refine(value => value.cliff_months <= value.vest_months, {
  message: "The cliff cannot be longer than the vesting period.", path: ["cliff_months"],
});
