import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/services";
import { ApplicationForm } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function NewApplicationPage() {
  const { data: user, error } = await getCurrentUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <Link
        href="/applications"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Applications
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Application</h1>
        <p className="text-muted-foreground">
          Track a new job application
        </p>
      </div>

      <ApplicationForm userId={user.id} />
    </div>
  );
}
