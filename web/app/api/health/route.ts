import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Liveness + readiness probe.
// Returns HTTP 200 with a JSON body when all checks pass, or HTTP 503 if any
// critical dependency is unreachable.  Do NOT add auth — external monitors hit
// this endpoint anonymously.
export const dynamic = "force-dynamic";

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

async function checkSupabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const supabase = await createClient();
    // A lightweight RPC-free way to verify connectivity: list zero rows from a
    // real table.  If the schema hasn't been created yet this still succeeds
    // (PGRST returns an empty array, not an error).
    const { error } = await supabase
      .from("job_applications")
      .select("id")
      .limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function GET() {
  const start = Date.now();

  const supabaseResult = await checkSupabase();

  const checks = {
    supabase: supabaseResult,
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    {
      ok: allOk,
      timestamp: new Date().toISOString(),
      uptimeMs: process.uptime() * 1000,
      totalLatencyMs: Date.now() - start,
      checks,
    },
    { status }
  );
}
