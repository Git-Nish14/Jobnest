import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertEmbeddings, type EmbeddingItem } from "@/lib/features/nestai-rag";

// Vercel function timeout — 300 s (max on Pro plan).
// The cron loops through all Pro users and calls the OpenAI Embeddings API per user,
// so the default 10 s timeout would fire on any non-trivial dataset.
export const maxDuration = 300;

// Process at most MAX_CONCURRENT users in parallel to avoid saturating the
// OpenAI Embeddings rate limit (500 RPM on the default tier).
const MAX_CONCURRENT = 5;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ skipped: "OPENAI_API_KEY not configured" });
  }

  const admin = createAdminClient();
  const results = { indexed: 0, skipped: 0, errors: [] as string[] };

  let page = 0;
  const perPage = 50;

  while (true) {
    const { data: subs, error } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("plan", "pro")
      .eq("status", "active")
      .range(page * perPage, (page + 1) * perPage - 1);

    if (error) {
      results.errors.push(`subscriptions fetch page ${page}: ${error.message}`);
      break;
    }
    if (!subs?.length) break;

    // Process MAX_CONCURRENT users at a time to stay within OpenAI rate limits
    for (let i = 0; i < subs.length; i += MAX_CONCURRENT) {
      const batch = subs.slice(i, i + MAX_CONCURRENT);
      await Promise.allSettled(
        batch.map(async ({ user_id: userId }) => {
          try {
            const [
              { data: apps },
              { data: contacts },
              { data: reminders },
              { data: templates },
            ] = await Promise.all([
              admin.from("job_applications").select("*").eq("user_id", userId),
              admin.from("contacts").select("*").eq("user_id", userId),
              admin
                .from("reminders")
                .select("*")
                .eq("user_id", userId)
                .eq("is_completed", false),
              admin.from("email_templates").select("*").eq("user_id", userId),
            ]);

            const items: EmbeddingItem[] = [
              ...(apps ?? []).map((a) => ({
                sourceType: "application" as const,
                sourceId: String(a.id),
                data: a,
              })),
              ...(contacts ?? []).map((c) => ({
                sourceType: "contact" as const,
                sourceId: String(c.id),
                data: c,
              })),
              ...(reminders ?? []).map((r) => ({
                sourceType: "reminder" as const,
                sourceId: String(r.id),
                data: r,
              })),
              ...(templates ?? []).map((t) => ({
                sourceType: "email_template" as const,
                sourceId: String(t.id),
                data: t,
              })),
            ];

            // The admin client has service_role rights and bypasses RLS — correct
            // for a cron that writes on behalf of users. Cast through SupabaseClient
            // because upsertEmbeddings expects the base type without DB generics.
            await upsertEmbeddings(admin as unknown as SupabaseClient, userId, items);
            results.indexed++;
          } catch (err) {
            results.skipped++;
            const msg = err instanceof Error ? err.message : String(err);
            // Cap error array to prevent large response bodies when many users fail
            if (results.errors.length < 20) {
              results.errors.push(`${userId}: ${msg}`);
            }
          }
        })
      );
    }

    if (subs.length < perPage) break;
    page++;
  }

  console.log("[cron/nestai-reindex]", results);
  return NextResponse.json(results);
}
