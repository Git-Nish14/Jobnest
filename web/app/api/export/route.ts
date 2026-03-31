import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportSchema } from "@/lib/validations/api";
import { ApiError, errorResponse, validateQuery } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw ApiError.unauthorized();
    }

    // Rate limit exports (expensive operation)
    const rateLimitResult = await checkRateLimit(`export:${user.id}`, {
      maxRequests: 10,
      windowMs: 60 * 60 * 1000, // 10 exports per hour
    });

    if (!rateLimitResult.allowed) {
      throw ApiError.tooManyRequests("Export limit exceeded. Please try again later.");
    }

    // Validate and parse query parameters
    const { searchParams } = new URL(request.url);
    const { format, includeNotes, statuses } = validateQuery(searchParams, exportSchema);

    // SECURITY FIX: Always filter by user_id to prevent data leakage
    let query = supabase
      .from("job_applications")
      .select("*")
      .eq("user_id", user.id) // CRITICAL: Filter by authenticated user
      .order("applied_date", { ascending: false });

    if (statuses && statuses.length > 0) {
      query = query.in("status", statuses);
    }

    const { data: applications, error } = await query;

    if (error) {
      console.error("Export query error:", error);
      throw ApiError.internal("Failed to fetch applications");
    }

    if (format === "json") {
      return NextResponse.json(applications, {
        headers: {
          "Content-Disposition": 'attachment; filename="applications.json"',
        },
      });
    }

    // CSV format
    const headers = [
      "Company",
      "Position",
      "Status",
      "Applied Date",
      "Location",
      "Salary Range",
      "Job ID",
      "Job URL",
      ...(includeNotes ? ["Notes"] : []),
    ];

    const escapeCSV = (value: string | null): string => {
      if (!value) return "";
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const rows = applications?.map((app) => {
      return [
        escapeCSV(app.company),
        escapeCSV(app.position),
        escapeCSV(app.status),
        app.applied_date,
        escapeCSV(app.location),
        escapeCSV(app.salary_range),
        escapeCSV(app.job_id),
        escapeCSV(app.job_url),
        ...(includeNotes ? [escapeCSV(app.notes)] : []),
      ].join(",");
    });

    const csv = [headers.join(","), ...(rows || [])].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="applications.csv"',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
