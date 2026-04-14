import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ATSScanner } from "@/components/ats/ATSScanner";
import { ATS_PROVIDERS, type ATSProvider } from "@/app/api/documents/ats-scan/route";
import type { ApplicationDocument } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ATS Scanner",
  description: "Match your resume against a job description and discover exactly what keywords are missing.",
};

// Server-side: env vars checked here so keys never reach the client bundle.
function getConfiguredProviders(): ATSProvider[] {
  const map: Record<ATSProvider, string | undefined> = {
    groq:       process.env.GROQ_API_KEY,
    openai:     process.env.OPENAI_API_KEY,
    claude:     process.env.ANTHROPIC_API_KEY,
    gemini:     process.env.GEMINI_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
  };
  return ATS_PROVIDERS.filter((p) => !!map[p]);
}

export default async function ATSScanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pre-fetch ATS-compatible documents (PDF / DOCX / DOC / TXT / MD)
  const { data: docs } = await supabase
    .from("application_documents")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .in("mime_type", [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
    ])
    .order("uploaded_at", { ascending: false });

  const configuredProviders = getConfiguredProviders();

  return (
    <div className="space-y-8">
      <header className="db-page-header">
        <div>
          <h1 className="db-page-title">ATS Scanner</h1>
          <p className="db-page-subtitle">
            Match your resume against a job description and discover exactly what keywords are missing.
          </p>
        </div>
      </header>

      <ATSScanner
        initialDocs={(docs ?? []) as ApplicationDocument[]}
        configuredProviders={configuredProviders}
      />
    </div>
  );
}
