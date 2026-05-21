import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { z } from "zod";
import { APPLICATION_STATUSES } from "@/config/constants";

const MAX_ROWS = 500;

const rowSchema = z.object({
  company: z.string().min(1).max(255).trim(),
  position: z.string().min(1).max(255).trim(),
  status: z
    .string()
    .optional()
    .default("Applied")
    .transform((v) => {
      const match = APPLICATION_STATUSES.find(
        (s) => s.toLowerCase() === v.toLowerCase()
      );
      return match ?? "Applied";
    }),
  applied_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .default(() => new Date().toISOString().split("T")[0]),
  location: z.string().max(255).trim().optional(),
  salary_range: z.string().max(100).trim().optional(),
  notes: z.string().max(5000).trim().optional(),
  job_url: z
    .string()
    .max(2083)
    .trim()
    .optional()
    .refine((v) => {
      if (!v) return true;
      // Block dangerous URL schemes before parsing
      const lower = v.toLowerCase();
      if (["javascript:", "data:", "vbscript:", "file:", "blob:"].some((s) => lower.startsWith(s))) return false;
      try { new URL(v); return true; } catch { return false; }
    }, "Invalid URL"),
  source: z.string().max(100).trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`bulk-import:${user.id}`, { maxRequests: 5, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many import requests. Please wait.");

    const body = await request.json();
    const rows: unknown[] = Array.isArray(body.rows) ? body.rows : [];

    if (rows.length === 0) throw ApiError.badRequest("No rows provided.");
    if (rows.length > MAX_ROWS) throw ApiError.badRequest(`Maximum ${MAX_ROWS} rows per import.`);

    const valid: z.infer<typeof rowSchema>[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = rowSchema.safeParse(rows[i]);
      if (result.success) {
        valid.push(result.data);
      } else {
        errors.push({
          row: i + 1,
          message: result.error.issues.map((e) => e.message).join(", "),
        });
      }
    }

    if (valid.length === 0) {
      return NextResponse.json({ success: false, imported: 0, errors }, { status: 422 });
    }

    const inserts = valid.map((row) => ({
      user_id: user.id,
      company: row.company,
      position: row.position,
      status: row.status,
      applied_date: row.applied_date,
      location: row.location || null,
      salary_range: row.salary_range || null,
      notes: row.notes || null,
      job_url: row.job_url || null,
      source: row.source || null,
    }));

    const { error: insertError } = await supabase
      .from("job_applications")
      .insert(inserts);

    if (insertError) {
      console.error("[bulk-import] insert failed:", insertError.message);
      throw ApiError.internal("Import failed. Please check your data and try again.");
    }

    return NextResponse.json({ success: true, imported: valid.length, errors });
  } catch (error) {
    return errorResponse(error);
  }
}
