import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatGptAuthorize } from "@/components/profile/chatgpt-authorize";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Connect ChatGPT",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ChatGptAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string | string[] }>;
}) {
  const { request } = await searchParams;
  const requestId = typeof request === "string" && /^[A-Za-z0-9_-]{43}$/.test(request) ? request : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const returnPath = requestId
      ? `/integrations/chatgpt/authorize?request=${encodeURIComponent(requestId)}`
      : "/integrations/chatgpt/authorize";
    redirect(`/login?redirect=${encodeURIComponent(returnPath)}`);
  }

  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10 sm:py-16">
      <Link href="/dashboard" className="text-xl font-semibold tracking-tight">Jobnest</Link>
      {requestId ? (
        <ChatGptAuthorize requestId={requestId} email={user.email ?? ""} />
      ) : (
        <div className="w-full max-w-lg space-y-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-2xl font-semibold">Connection request unavailable</h1>
          <p className="text-sm text-muted-foreground">Return to ChatGPT and start connecting the Jobnest plugin again.</p>
          <Link href="/profile#chatgpt" className="inline-block text-sm text-primary underline underline-offset-4">View plugin setup in Account Settings</Link>
        </div>
      )}
    </main>
  );
}
