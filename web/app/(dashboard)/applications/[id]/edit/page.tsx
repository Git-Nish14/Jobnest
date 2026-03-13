import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, getApplicationById } from "@/services";
import { ApplicationForm } from "@/components/forms";

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

  const { data: application, error } = await getApplicationById(id);
  if (error || !application) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/applications/${id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Application
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Application</h1>
        <p className="text-muted-foreground">
          Update the details for {application.position} at {application.company}
        </p>
      </div>

      <ApplicationForm application={application} userId={user.id} />
    </div>
  );
}
