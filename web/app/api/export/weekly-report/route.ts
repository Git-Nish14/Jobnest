import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getDashboardAnalytics } from "@/services";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { WeeklyReportPDF } from "@/components/pdf/WeeklyReportPDF";
import { readWeeklyGoal } from "@/lib/job-search/preferences";
import { calendarDate, dateLabel, validTimezone } from "@/lib/job-search/calendar";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`weekly-report-pdf:${user.id}`, {
      maxRequests: 10,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Weekly report limit: 10 per day.");

    // One authoritative goal shared by Profile, dashboard, planner, and reports.
    const goal = readWeeklyGoal(user.user_metadata?.weekly_goal);

    const { data: analytics, error: analyticsError } = await getDashboardAnalytics();
    if (analyticsError || !analytics) throw ApiError.internal("Failed to fetch analytics");

    const localDate = calendarDate(new Date(), validTimezone(user.user_metadata?.timezone));
    const generatedAt = dateLabel(localDate, { year: "numeric", month: "long", day: "numeric" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await (renderToBuffer as (el: any) => Promise<Buffer>)(
      createElement(WeeklyReportPDF, {
        analytics,
        goal,
        generatedAt,
        userEmail: user.email,
      })
    );

    const dateStr = localDate;
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
