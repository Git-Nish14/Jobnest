import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { OfferComparisonPDF } from "@/components/salary/OfferComparisonPDF";
import type { SalaryDetails } from "@/types";

const schema = z.object({
  application_ids: z.array(z.string().uuid()).min(1).max(3),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rateLimitResult = await checkRateLimit(`salary-pdf:${user.id}`, {
      maxRequests: 5,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!rateLimitResult.allowed) throw ApiError.tooManyRequests("PDF export limit: 5 per day.");

    const { application_ids } = await validateBody(request, schema);

    // Fetch salary_details + application info for the given IDs, scoped to this user
    const { data: salaryRows, error: salaryError } = await supabase
      .from("salary_details")
      .select("*, job_applications!inner(company, position, user_id)")
      .in("application_id", application_ids);

    if (salaryError) throw ApiError.internal("Failed to fetch salary data");

    // Filter to ensure all belong to this user
    const owned = (salaryRows ?? []).filter(
      (row) => (row as { job_applications: { user_id: string } }).job_applications?.user_id === user.id
    );

    if (owned.length === 0) throw ApiError.notFound("No salary data found");

    const offers = owned.map((row) => ({
      salary: row as unknown as SalaryDetails,
      company: (row as { job_applications: { company: string } }).job_applications.company,
      position: (row as { job_applications: { position: string } }).job_applications.position,
    }));

    const generatedAt = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    // @react-pdf/renderer's renderToBuffer expects its own ReactElement type;
    // the cast is safe — OfferComparisonPDF returns a <Document> element.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await (renderToBuffer as (el: any) => Promise<Buffer>)(
      createElement(OfferComparisonPDF, { offers, generatedAt })
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="offer-comparison-${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
