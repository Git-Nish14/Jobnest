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
    <div className="application-page-shell space-y-4 sm:space-y-6">
      <Link
        href="/applications"
        className="application-back-link inline-flex min-h-11 items-center gap-2 text-sm text-[#55433d] hover:text-[#99462a] transition-colors font-medium dark:text-white/60"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Applications
      </Link>

      <ApplicationForm userId={user.id} />
    </div>
  );
}
