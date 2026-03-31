/**
 * Trigger.dev job — parse a document in the background.
 *
 * Moves PDF/DOCX text extraction off the request path, preventing Vercel's
 * 10-second timeout from killing large uploads.
 *
 * Trigger with:
 *   import { tasks } from "@trigger.dev/sdk/v3";
 *   await tasks.trigger("parse-document", { userId, filePath, documentId });
 */
import { task } from "@trigger.dev/sdk/v3";
import { createAdminClient } from "@/lib/supabase/admin";

export const parseDocumentTask = task({
  id: "parse-document",
  maxDuration: 120, // seconds — enough for large PDFs
  retry: { maxAttempts: 2 },

  run: async (payload: { userId: string; filePath: string; documentId: string }) => {
    const { userId, filePath, documentId } = payload;
    const admin = createAdminClient();

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await admin.storage
      .from("documents")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Extract text
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

    let extractedText: string | null = null;

    if (ext === "pdf") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");
      const result = await pdfParse(buffer);
      extractedText = result.text.replace(/\s{3,}/g, "\n").trim().slice(0, 50_000) || null;
    } else if (ext === "docx" || ext === "doc") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth") as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value.trim().slice(0, 50_000) || null;
    } else if (ext === "txt" || ext === "md") {
      extractedText = buffer.toString("utf-8").trim().slice(0, 50_000) || null;
    }

    // Store extracted text back on the document row (if the column exists)
    if (extractedText) {
      await admin
        .from("application_documents")
        .update({ extracted_text: extractedText })
        .eq("id", documentId)
        .eq("user_id", userId);
    }

    return { documentId, extractedChars: extractedText?.length ?? 0 };
  },
});
