import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getDashboardAnalytics } from "@/services";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { WeeklyReportPDF } from "@/components/pdf/WeeklyReportPDF";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`weekly-report-pdf:${user.id}`, {
      maxRequests: 10,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Weekly report limit: 10 per day.");

    // Parse goal from query param — user's own localStorage preference, not sensitive
    const rawGoal = request.nextUrl.searchParams.get("goal");
    const goal = Math.max(1, Math.min(100, parseInt(rawGoal ?? "5", 10) || 5));

    const { data: analytics, error: analyticsError } = await getDashboardAnalytics();
    if (analyticsError || !analytics) throw ApiError.internal("Failed to fetch analytics");

    const generatedAt = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await (renderToBuffer as (el: any) => Promise<Buffer>)(
      createElement(WeeklyReportPDF, {
        analytics,
        goal,
        generatedAt,
        userEmail: user.email,
      })
    );

    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="weekly-report-${dateStr}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
