import { NextRequest } from "next/server";
import { z } from "zod";
import * as Diff from "diff";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { extractDocumentText } from "@/lib/utils/document-parser";

const schema = z.object({
  base_id:    z.string().uuid("Invalid base document ID"),
  compare_id: z.string().uuid("Invalid compare document ID"),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`doc-diff:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many diff requests. Please wait.");

    const { base_id, compare_id } = await validateBody(request, schema);

    if (base_id === compare_id) throw ApiError.badRequest("Cannot diff a document against itself.");

    // Fetch both docs, verify ownership
    const { data: docs, error: docsError } = await supabase
      .from("application_documents")
      .select("id, storage_path, label, original_name, uploaded_at, is_current")
      .in("id", [base_id, compare_id])
      .eq("user_id", user.id);

    if (docsError) throw ApiError.internal("Failed to fetch documents.");
    if (!docs || docs.length < 2) throw ApiError.notFound("One or both documents not found.");

    const base    = docs.find((d) => d.id === base_id)!;
    const compare = docs.find((d) => d.id === compare_id)!;

    // Extract text from both documents
    const [baseResult, compareResult] = await Promise.all([
      extractDocumentText(supabase, base.storage_path),
      extractDocumentText(supabase, compare.storage_path),
    ]);

    if (baseResult.error || !baseResult.text) {
      throw ApiError.badRequest(`Could not extract text from base document: ${baseResult.error ?? "empty document"}`);
    }
    if (compareResult.error || !compareResult.text) {
      throw ApiError.badRequest(`Could not extract text from compare document: ${compareResult.error ?? "empty document"}`);
    }

    // Compute word-level diff
    const changes = Diff.diffWords(baseResult.text, compareResult.text);

    const added   = changes.filter((c) => c.added).reduce((n, c) => n + (c.value.split(/\s+/).filter(Boolean).length), 0);
    const removed = changes.filter((c) => c.removed).reduce((n, c) => n + (c.value.split(/\s+/).filter(Boolean).length), 0);

    return successResponse({
      base: {
        id:         base.id,
        label:      base.label,
        name:       base.original_name,
        is_current: base.is_current,
        uploaded_at:base.uploaded_at,
      },
      compare: {
        id:         compare.id,
        label:      compare.label,
        name:       compare.original_name,
        is_current: compare.is_current,
        uploaded_at:compare.uploaded_at,
      },
      changes,
      stats: { added, removed, unchanged: changes.filter((c) => !c.added && !c.removed).reduce((n, c) => n + c.value.split(/\s+/).filter(Boolean).length, 0) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
