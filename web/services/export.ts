import { createClient } from "@/lib/supabase/server";
import type { JobApplication, ApiResponse } from "@/types";

export interface ExportOptions {
  format: "csv" | "json";
  includeNotes?: boolean;
  statuses?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export async function exportApplications(
  options: ExportOptions
): Promise<ApiResponse<string>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("job_applications")
      .select("*")
      .order("applied_date", { ascending: false });

    if (options.statuses && options.statuses.length > 0) {
      query = query.in("status", options.statuses);
    }

    if (options.dateFrom) {
      query = query.gte("applied_date", options.dateFrom);
    }

    if (options.dateTo) {
      query = query.lte("applied_date", options.dateTo);
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    const applications = data as JobApplication[];

    if (options.format === "csv") {
      const csv = convertToCSV(applications, options.includeNotes);
      return { data: csv, error: null };
    } else {
      const json = JSON.stringify(applications, null, 2);
      return { data: json, error: null };
    }
  } catch {
    return {
      data: null,
      error: { message: "Failed to export applications" },
    };
  }
}

function convertToCSV(
  applications: JobApplication[],
  includeNotes = false
): string {
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

  const rows = applications.map((app) => {
    const row = [
      escapeCSV(app.company),
      escapeCSV(app.position),
      escapeCSV(app.status),
      app.applied_date,
      escapeCSV(app.location || ""),
      escapeCSV(app.salary_range || ""),
      escapeCSV(app.job_id || ""),
      escapeCSV(app.job_url || ""),
      ...(includeNotes ? [escapeCSV(app.notes || "")] : []),
    ];
    return row.join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Generate a detailed PDF report (returns HTML for PDF generation)
export function generateReportHTML(
  applications: JobApplication[],
  title = "Job Applications Report"
): string {
  const statusCounts: Record<string, number> = {};
  applications.forEach((app) => {
    statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #3B82F6; padding-bottom: 10px; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .stat-card { background: #f3f4f6; padding: 15px 20px; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #3B82F6; }
    .stat-label { font-size: 12px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f3f4f6; text-align: left; padding: 12px; font-size: 12px; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .status-applied { background: #DBEAFE; color: #1E40AF; }
    .status-interview { background: #E9D5FF; color: #7C3AED; }
    .status-offer { background: #D1FAE5; color: #059669; }
    .status-rejected { background: #FEE2E2; color: #DC2626; }
    .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${title}</h1>

  <div class="summary">
    <div class="stat-card">
      <div class="stat-value">${applications.length}</div>
      <div class="stat-label">Total Applications</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${statusCounts["Applied"] || 0}</div>
      <div class="stat-label">Applied</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${statusCounts["Interview"] || 0}</div>
      <div class="stat-label">Interviews</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${statusCounts["Offer"] || 0}</div>
      <div class="stat-label">Offers</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Company</th>
        <th>Position</th>
        <th>Status</th>
        <th>Applied Date</th>
        <th>Location</th>
      </tr>
    </thead>
    <tbody>
      ${applications
        .map(
          (app) => `
        <tr>
          <td>${app.company}</td>
          <td>${app.position}</td>
          <td><span class="status status-${app.status.toLowerCase().replace(" ", "-")}">${app.status}</span></td>
          <td>${new Date(app.applied_date).toLocaleDateString()}</td>
          <td>${app.location || "-"}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    Generated by Jobnest on ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
  `;

  return html;
}
