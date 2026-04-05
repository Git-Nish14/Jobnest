import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ApiError, errorResponse } from "@/lib/api/errors";

/**
 * Academic email domains considered eligible for the student discount.
 *
 * Security note: domain matching is done on the EMAIL stored in Supabase Auth
 * (server-side), never on client-supplied input. Users cannot spoof this by
 * typing a different email in a form field.
 *
 * This is an allow-list, not a block-list — unlisted domains are ineligible
 * but can still access the trial via the standard promo-code field at checkout.
 */
const ACADEMIC_TLDS = new Set([
  ".edu",      // United States
  ".ac.uk",    // United Kingdom
  ".edu.au",   // Australia
  ".ac.nz",    // New Zealand
  ".ac.za",    // South Africa
  ".edu.sg",   // Singapore
  ".edu.in",   // India
  ".ac.in",    // India (alt)
  ".edu.cn",   // China
  ".edu.hk",   // Hong Kong
  ".edu.my",   // Malaysia
  ".edu.ph",   // Philippines
  ".ac.jp",    // Japan
  ".edu.br",   // Brazil
  ".edu.mx",   // Mexico
  ".edu.co",   // Colombia
]);

function isAcademicEmail(email: string): boolean {
  const lower = email.toLowerCase();
  for (const tld of ACADEMIC_TLDS) {
    if (lower.endsWith(tld)) return true;
  }
  return false;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) throw ApiError.unauthorized();
    if (!user.email) throw ApiError.unauthorized("No email associated with this account.");

    // Rate-limit to 10/min — prevents brute-forcing domain checks
    const rl = await checkRateLimit(`student-verify:${user.id}`, {
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests. Please try again shortly.");

    const eligible = isAcademicEmail(user.email);
    const domain = user.email.split("@")[1] ?? "";

    return NextResponse.json({ eligible, domain });
  } catch (err) {
    return errorResponse(err);
  }
}
