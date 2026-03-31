import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome to Jobnest" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Only new users (onboarding_completed === false) should be here.
  // Any other value (true or undefined = existing user) → go to dashboard.
  if (user.user_metadata?.onboarding_completed !== false) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 sm:py-16">
      {/* Logo wordmark */}
      <div className="mb-10 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-xl bg-[#99462a] flex items-center justify-center text-white text-sm font-bold">
          J
        </div>
        <span className="text-xl font-semibold text-[#1a1c1b]">Jobnest</span>
      </div>

      <div className="w-full max-w-xl">
        <OnboardingWizard
          user={{
            email: user.email ?? "",
            displayName: user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "",
          }}
        />
      </div>
    </div>
  );
}
