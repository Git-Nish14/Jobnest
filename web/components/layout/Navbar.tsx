"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Calendar,
  Bell,
  Users,
  Mail,
  DollarSign,
  Menu,
  X,
  HelpCircle,
  ChevronRight,
  Sparkles,
  UserCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface NavbarProps {
  user?: { email?: string } | null;
}

const dashboardLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: FileText },
  { href: "/interviews", label: "Interviews", icon: Calendar },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/templates", label: "Templates", icon: Mail },
  { href: "/salary", label: "Salary", icon: DollarSign },
  { href: "/nestai", label: "NESTAi", icon: Sparkles },
];

export function Navbar({ user: initialUser }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(initialUser);

  const isDashboardPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/applications") ||
    pathname.startsWith("/interviews") ||
    pathname.startsWith("/reminders") ||
    pathname.startsWith("/contacts") ||
    pathname.startsWith("/templates") ||
    pathname.startsWith("/salary") ||
    pathname.startsWith("/nestai") ||
    pathname.startsWith("/profile");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ email: data.user.email });
      } else {
        setUser(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  const isAuthenticated = !!user;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || "U";
  const userEmail = user?.email || "";

  // Authenticated dashboard navbar
  if (isAuthenticated && isDashboardPage) {
    return (
      <>
        <nav className="sticky top-0 z-50 w-full border-b backdrop-blur-md atelier-nav">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 sm:h-16 items-center justify-between">
              {/* Left: Logo + Nav */}
              <div className="flex items-center gap-6">
                <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
                  <Image
                    src="/new_logo_1.png"
                    alt="Jobnest"
                    width={34}
                    height={34}
                    className="h-8 w-8"
                    priority
                  />
                  <span className="text-xl atelier-nav-logo">Jobnest</span>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center">
                  <ul className="flex items-center gap-0.5">
                    {dashboardLinks.map((link) => {
                      const isActive =
                        pathname === link.href ||
                        (link.href !== "/dashboard" && pathname.startsWith(link.href + "/"));
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className={cn(
                              "px-3 py-1.5 text-sm rounded-lg transition-all duration-150",
                              isActive
                                ? "font-semibold atelier-nav-link-active"
                                : "hover:bg-[#d97757]/10 atelier-nav-link-inactive"
                            )}
                          >
                            {link.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>

              {/* Right: Actions + Profile */}
              <div className="flex items-center gap-2">
                {/* Profile Dropdown */}
                {mounted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="flex items-center rounded-full p-0.5 ring-2 ring-transparent hover:ring-[#dbc1b9] transition-all focus:outline-none">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="atelier-avatar text-sm font-semibold">
                            {userInitial}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <div className="px-3 py-2.5 border-b atelier-dropdown-header">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="atelier-avatar font-semibold text-sm">
                              {userInitial}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#1a1c1b] break-all leading-tight">{userEmail}</p>
                            <p className="text-xs text-[#55433d] mt-0.5">Free Plan</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-1">
                        <DropdownMenuItem asChild>
                          <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                            <UserCircle className="h-4 w-4" />
                            Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/contact" className="flex items-center gap-2 cursor-pointer">
                            <HelpCircle className="h-4 w-4" />
                            Help & Support
                          </Link>
                        </DropdownMenuItem>
                      </div>
                      <DropdownMenuSeparator />
                      <div className="p-1">
                        <DropdownMenuItem
                          onClick={handleSignOut}
                          className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Mobile Menu Button */}
                <button
                  type="button"
                  className="lg:hidden p-1.5 -mr-1 rounded-md hover:bg-[#dbc1b9]/20 transition-colors"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile Slide-out Menu */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-50 bg-black/50 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide-out Panel */}
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xs lg:hidden db-root atelier-slide-panel">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between px-4 h-14 border-b atelier-dropdown-header">
                  <span className="text-xl atelier-nav-logo">Jobnest</span>
                  <button
                    type="button"
                    className="p-2 -mr-2 rounded-md hover:bg-[#dbc1b9]/20 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-4">
                  <ul className="space-y-1 px-3">
                    {dashboardLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive =
                        pathname === link.href ||
                        (link.href !== "/dashboard" && pathname.startsWith(link.href + "/"));
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                              isActive
                                ? "bg-[#99462a]/10 atelier-nav-link-active"
                                : "atelier-nav-link-inactive hover:bg-[#d97757]/10"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {link.label}
                            {isActive && (
                              <ChevronRight className="h-4 w-4 ml-auto" />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                {/* Footer with User Info */}
                <div className="border-t p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="atelier-avatar font-semibold">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1a1c1b] break-all leading-tight">{userEmail}</p>
                      <p className="text-xs text-[#55433d] mt-0.5">Free Plan</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-center gap-2"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // Public navbar (contact, privacy, terms pages etc.)
  return (
    <nav className="sticky top-0 z-50 w-full border-b backdrop-blur-md atelier-nav">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/new_logo_1.png"
            alt="Jobnest"
            width={34}
            height={34}
            className="h-8 w-8"
            priority
          />
          <span className="text-xl atelier-nav-logo">Jobnest</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="shadow-sm">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="sm:hidden p-2 -mr-2 rounded-md hover:bg-muted/50 transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-[#dbc1b9]/20 bg-[#faf9f7] px-4 py-4 space-y-2">
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  Dashboard
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSignOut}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  Log in
                </Button>
              </Link>
              <Link href="/signup" className="block">
                <Button className="w-full">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
