import { createClient } from "@/lib/supabase/server";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

interface LayoutWrapperProps {
  children: React.ReactNode;
  showFooter?: boolean;
  footerVariant?: "full" | "simple";
}

export async function LayoutWrapper({
  children,
  showFooter = true,
  footerVariant = "simple",
}: LayoutWrapperProps) {
  let user = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase not configured or error
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user ? { email: user.email } : null} />
      <main className="flex-1">{children}</main>
      {showFooter && <Footer variant={footerVariant} />}
    </div>
  );
}
