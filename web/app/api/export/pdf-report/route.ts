import { NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getDashboardAnalytics } from "@/services";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { SearchHistoryPDF } from "@/components/pdf/SearchHistoryPDF";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`pdf-report:${user.id}`, {
      maxRequests: 5,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Full report limit: 5 per day.");

    const [{ data: analytics, error: analyticsError }, { data: applications, error: appsError }] =
      await Promise.all([
        getDashboardAnalytics(),
        supabase
          .from("job_applications")
          .select("company,position,status,applied_date,source,salary_range")
          .eq("user_id", user.id)   // defence-in-depth: RLS is primary guard, explicit filter matches CSV/JSON export pattern
          .order("applied_date", { ascending: false }),
      ]);

    if (analyticsError || !analytics) throw ApiError.internal("Failed to fetch analytics");
    if (appsError) throw ApiError.internal("Failed to fetch applications");

    const generatedAt = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    const userName: string | undefined =
      user.user_metadata?.full_name || user.email?.split("@")[0] || undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await (renderToBuffer as (el: any) => Promise<Buffer>)(
      createElement(SearchHistoryPDF, {
        analytics,
        applications: applications ?? [],
        generatedAt,
        userName,
        userEmail: user.email,
      })
    );

    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="job-search-report-${dateStr}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
