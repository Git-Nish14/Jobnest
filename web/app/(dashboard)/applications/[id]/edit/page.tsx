import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, getApplicationById } from "@/services";
import { ApplicationForm } from "@/components/forms";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditApplicationPage({ params }: PageProps) {
  const { id } = await params;

  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const [{ data: application, error }, { data: currentDocs }] = await Promise.all([
    getApplicationById(id),
    supabase
      .from("application_documents")
      .select("id, label, storage_path, original_name")
      .eq("application_id", id)
      .eq("user_id", user.id)
      .eq("is_current", true),
  ]);

  if (error || !application) {
    notFound();
  }

  return (
    <div className="application-page-shell space-y-4 sm:space-y-6">
      <Link
        href={`/applications/${id}`}
        className="application-back-link inline-flex min-h-11 items-center gap-2 text-sm text-[#55433d] hover:text-[#99462a] transition-colors font-medium dark:text-white/60"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to application
      </Link>

      <ApplicationForm
        application={application}
        userId={user.id}
        initialDocuments={currentDocs ?? []}
      />
    </div>
  );
}
