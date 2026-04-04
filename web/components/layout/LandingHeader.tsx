"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/actions/auth";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { label: "Overview",     href: "/" },
  { label: "Features",     href: "/#features" },
  { label: "Testimonials", href: "/#testimonials" },
  { label: "Pricing",      href: "/pricing" },
];

export function LandingHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { email: data.user.email } : null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ? { email: session.user.email } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    // "/" is active only on the landing page
    if (href === "/") return pathname === "/";
    // "/pricing" is active on /pricing
    const base = href.split("#")[0];
    return base !== "/" && pathname.startsWith(base);
  };

  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction();
    });
  };

  return (
    <header className="sticky top-0 w-full z-50 backdrop-blur-md border-b landing-header">
      <div className="flex justify-between items-center px-6 py-3.5 w-full max-w-7xl mx-auto">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/new_logo_1.png" alt="Jobnest" width={36} height={36} priority className="h-9 w-9 logo-light" />
          <Image src="/dark_logo.png"  alt="Jobnest" width={36} height={36} priority className="h-9 w-9 logo-dark" />
          <span className="text-xl landing-logo-text">Jobnest</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                isActive(href)
                  ? "font-semibold landing-nav-active"
                  : "landing-nav-link"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right: theme toggle + auth CTAs + mobile hamburger */}
        <div className="flex items-center gap-3">
          <ThemeToggle className="landing-theme-toggle" />

          {/* Auth — desktop */}
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:block text-sm font-medium landing-login-link"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isPending}
                className="hidden sm:flex items-center gap-1.5 text-sm font-medium landing-login-link disabled:opacity-50"
              >
                {isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <LogOut className="h-3.5 w-3.5" />}
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden sm:block text-sm font-medium landing-login-link"
            >
              Log in
            </Link>
          )}

          <Link
            href="/signup"
            className="px-6 py-2 rounded-full font-medium text-sm transition-all landing-btn-primary"
          >
            Get Started
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-1.5 -mr-1 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/8"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t px-6 py-4 space-y-1 landing-header">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className={`block py-2 text-sm ${
                isActive(href)
                  ? "font-semibold landing-nav-active"
                  : "landing-nav-link"
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="pt-3 border-t mt-3 space-y-1">
            {user ? (
              <>
                <Link href="/dashboard" className="block py-2 text-sm landing-nav-link">
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isPending}
                  className="flex items-center gap-1.5 py-2 text-sm landing-nav-link disabled:opacity-50"
                >
                  {isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <LogOut className="h-3.5 w-3.5" />}
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="block py-2 text-sm landing-nav-link">
                Log in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
