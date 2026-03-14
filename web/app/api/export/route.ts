import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";
  const includeNotes = searchParams.get("includeNotes") === "true";
  const statuses = searchParams.get("statuses")?.split(",").filter(Boolean);

  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch applications
  let query = supabase
    .from("job_applications")
    .select("*")
    .order("applied_date", { ascending: false });

  if (statuses && statuses.length > 0) {
    query = query.in("status", statuses);
  }

  const { data: applications, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
}
