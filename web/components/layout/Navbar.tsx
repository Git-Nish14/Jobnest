"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Loader2,
  Calendar,
  Bell,
  Users,
  Mail,
  DollarSign,
  ScanSearch,
  Menu,
  X,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  Sparkles,
  UserCircle,
  Trophy,
  Network,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/actions/auth";
import {
  Button,
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";

interface NavbarProps {
  user?: { email?: string; avatarUrl?: string | null } | null;
}

// Dropdown groups — rendered between "Applications" and "NESTAi"
const NAV_GROUPS = [
  {
    key: "job-search",
    label: "Job Search",
    links: [
      { href: "/interviews",  label: "Interviews",     icon: Calendar,   desc: "Track your interview pipeline"  },
      { href: "/reminders",   label: "Reminders",      icon: Bell,       desc: "Follow-up nudges & alerts"      },
      { href: "/contacts",    label: "Contacts",       icon: Users,      desc: "Recruiters & hiring contacts"    },
      { href: "/networking",  label: "Networking",     icon: Network,    desc: "Outreach & coffee chats"         },
    ],
  },
  {
    key: "tools",
    label: "Tools",
    links: [
      { href: "/templates",   label: "Templates",      icon: Mail,       desc: "Email & message templates"       },
      { href: "/salary",      label: "Salary",         icon: DollarSign, desc: "TC benchmarks & offer compare"   },
      { href: "/ats",         label: "ATS Scan",       icon: ScanSearch, desc: "Resume keyword audit"             },
      { href: "/prep",        label: "Interview Prep", icon: Trophy,     desc: "STAR stories & practice"         },
    ],
  },
];

// Links covered by the bottom tab bar — excluded from mobile slide panel
const BOTTOM_TAB_HREFS = new Set(["/dashboard", "/applications", "/interviews", "/nestai"]);

function Logo({ size = 34 }: { size?: number }) {
  return (
    <>
      <Image src="/new_logo_1.png" alt="Jobnest" width={size} height={size} className="h-8 w-8 logo-light" priority />
      <Image src="/dark_logo.png"  alt="Jobnest" width={size} height={size} className="h-8 w-8 logo-dark"  priority />
    </>
  );
}

export function Navbar({ user: initialUser }: NavbarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(initialUser);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUser?.avatarUrl ?? null);
  const [isPending, startTransition] = useTransition();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDashboardPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/applications") ||
    pathname.startsWith("/interviews") ||
    pathname.startsWith("/reminders") ||
    pathname.startsWith("/contacts") ||
    pathname.startsWith("/templates") ||
    pathname.startsWith("/salary") ||
    pathname.startsWith("/nestai") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/documents") ||
    pathname.startsWith("/ats") ||
    pathname.startsWith("/prep") ||
    pathname.startsWith("/networking") ||
    pathname.startsWith("/onboarding");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ email: data.user.email });
        const raw = data.user.user_metadata?.avatar_url;
        setAvatarUrl(typeof raw === "string" ? raw : null);
      } else {
        setUser(null);
        setAvatarUrl(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email });
        const raw = session.user.user_metadata?.avatar_url;
        setAvatarUrl(typeof raw === "string" ? raw : null);
      } else {
        setUser(null);
        setAvatarUrl(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close mobile menu and any open dropdown on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  // Sync nav-open class to <html> so CSS can slide the bottom tab bar away
  useEffect(() => {
    const html = document.documentElement;
    if (mobileMenuOpen) {
      html.classList.add("nav-open");
    } else {
      html.classList.remove("nav-open");
    }
    return () => { html.classList.remove("nav-open"); };
  }, [mobileMenuOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!openGroup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenGroup(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openGroup]);

  // Clean up hover timer on unmount
  useEffect(() => {
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  const openNav = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenGroup(key);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenGroup(null), 120);
  };

  const isAuthenticated = !!user;

  const handleSignOut = (scope: "local" | "global") => {
    setLogoutOpen(false);
    sessionStorage.removeItem("jobnest_session");
    startTransition(async () => {
      await signOutAction(scope);
    });
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || "U";
  const userEmail = user?.email || "";

  if (isAuthenticated && isDashboardPage) {
    return (
      <>
        <nav className="sticky top-0 z-50 w-full border-b backdrop-blur-md atelier-nav">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 sm:h-16 items-center justify-between">

              {/* ── Logo + desktop nav ── */}
              <div className="flex items-center gap-4">
                <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
                  <Logo />
                  <span className="text-xl atelier-nav-logo">Jobnest</span>
                </Link>

                <nav className="hidden lg:flex items-center" aria-label="Main navigation">
                  <ul className="flex items-center gap-0.5">

                    {/* Applications — primary direct link */}
                    <li>
                      {(() => {
                        const isActive = pathname === "/applications" || pathname.startsWith("/applications/");
                        return (
                          <Link
                            href="/applications"
                            className={cn(
                              "px-3 py-1.5 text-sm rounded-lg transition-all duration-150",
                              isActive
                                ? "font-semibold atelier-nav-link-active"
                                : "atelier-nav-link-inactive hover:bg-[#d97757]/10 dark:hover:bg-[#ccff00]/8"
                            )}
                          >
                            Applications
                          </Link>
                        );
                      })()}
                    </li>

                    {/* Job Search & Tools — hover dropdown groups */}
                    {NAV_GROUPS.map(group => {
                      const hasActive = group.links.some(
                        l => pathname === l.href || pathname.startsWith(l.href + "/")
                      );
                      const isOpen = openGroup === group.key;

                      return (
                        <li
                          key={group.key}
                          className="relative"
                          onMouseEnter={() => openNav(group.key)}
                          onMouseLeave={scheduleClose}
                          onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              setOpenGroup(null);
                            }
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => isOpen ? setOpenGroup(null) : openNav(group.key)}
                            aria-haspopup="true"
                            aria-expanded={isOpen}
                            className={cn(
                              "flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-all duration-150 select-none",
                              hasActive
                                ? "font-semibold atelier-nav-link-active"
                                : "atelier-nav-link-inactive hover:bg-[#d97757]/10 dark:hover:bg-[#ccff00]/8"
                            )}
                          >
                            {group.label}
                            <ChevronDown className={cn(
                              "h-3.5 w-3.5 transition-transform duration-150",
                              isOpen && "rotate-180"
                            )} />
                          </button>

                          {isOpen && (
                            <div
                              className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50"
                              onMouseEnter={() => openNav(group.key)}
                              onMouseLeave={scheduleClose}
                            >
                              <div className="min-w-56 rounded-xl border border-border/60 bg-background/95 backdrop-blur-sm shadow-lg shadow-black/5 dark:shadow-black/20 p-1.5">
                                {group.links.map(link => {
                                  const Icon = link.icon;
                                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                                  return (
                                    <Link
                                      key={link.href}
                                      href={link.href}
                                      className={cn(
                                        "flex items-start gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                                        isActive
                                          ? "bg-[#99462a]/10 dark:bg-[#ccff00]/10 atelier-nav-link-active"
                                          : "atelier-nav-link-inactive hover:bg-[#d97757]/10 dark:hover:bg-[#ccff00]/8"
                                      )}
                                    >
                                      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                                      <div>
                                        <p className={cn("font-medium leading-tight", isActive && "font-semibold")}>
                                          {link.label}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                                          {link.desc}
                                        </p>
                                      </div>
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}

                    {/* NESTAi — primary direct link with accent icon */}
                    <li>
                      {(() => {
                        const isActive = pathname === "/nestai" || pathname.startsWith("/nestai/");
                        return (
                          <Link
                            href="/nestai"
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all duration-150",
                              isActive
                                ? "font-semibold atelier-nav-link-active"
                                : "atelier-nav-link-inactive hover:bg-[#d97757]/10 dark:hover:bg-[#ccff00]/8"
                            )}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            NESTAi
                          </Link>
                        );
                      })()}
                    </li>

                  </ul>
                </nav>
              </div>

              {/* ── Right cluster ── */}
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <NotificationBell />
                {mounted && (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex shrink-0 min-h-11 min-w-11 items-center justify-center rounded-full ring-2 ring-transparent hover:ring-border transition-all focus:outline-none"
                        disabled={isPending}
                      >
                        <Avatar className="h-8 w-8">
                          {avatarUrl && <AvatarImage src={avatarUrl} alt={userInitial} className="object-cover" />}
                          <AvatarFallback className="atelier-avatar text-sm font-semibold">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : userInitial}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <div className="px-3 py-2.5 border-b atelier-dropdown-header">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-9 w-9 shrink-0">
                            {avatarUrl && <AvatarImage src={avatarUrl} alt={userInitial} className="object-cover" />}
                            <AvatarFallback className="atelier-avatar font-semibold text-sm">
                              {userInitial}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground break-all leading-tight">{userEmail}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Free Plan</p>
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
                          onClick={() => setLogoutOpen(true)}
                          disabled={isPending}
                          className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                        >
                          {isPending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <LogOut className="h-4 w-4" />}
                          {isPending ? "Signing out…" : "Sign out"}
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <button
                  type="button"
                  className="lg:hidden min-h-11 min-w-11 flex items-center justify-center -mr-2 rounded-md hover:bg-[#dbc1b9]/20 dark:hover:bg-[#ccff00]/8 transition-colors"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open menu"
                  disabled={isPending}
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* ── Mobile slide panel ── */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/60 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xs lg:hidden db-root atelier-slide-panel">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 h-14 border-b atelier-dropdown-header">
                  <span className="text-xl atelier-nav-logo">Jobnest</span>
                  <button
                    type="button"
                    className="min-h-11 min-w-11 flex items-center justify-center -mr-2 rounded-md hover:bg-[#dbc1b9]/20 dark:hover:bg-[#ccff00]/8 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-4" aria-label="Mobile navigation">
                  {/* Bottom tab bar covers Applications, Interviews, NESTAi — show only the rest */}
                  {NAV_GROUPS.map(group => {
                    const visibleLinks = group.links.filter(l => !BOTTOM_TAB_HREFS.has(l.href));
                    if (visibleLinks.length === 0) return null;
                    return (
                      <div key={group.key} className="mb-4">
                        <p className="px-6 pb-2 text-[10px] font-semibold uppercase tracking-widest atelier-nav-link-inactive opacity-50">
                          {group.label}
                        </p>
                        <ul className="space-y-1 px-3">
                          {visibleLinks.map(link => {
                            const Icon = link.icon;
                            const isActive =
                              pathname === link.href ||
                              pathname.startsWith(link.href + "/");
                            return (
                              <li key={link.href}>
                                <Link
                                  href={link.href}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-3 min-h-11 rounded-lg text-sm font-medium transition-colors",
                                    isActive
                                      ? "bg-[#99462a]/10 dark:bg-[#ccff00]/10 atelier-nav-link-active"
                                      : "atelier-nav-link-inactive hover:bg-[#d97757]/10 dark:hover:bg-[#ccff00]/8"
                                  )}
                                >
                                  <Icon className="h-5 w-5" />
                                  {link.label}
                                  {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </nav>

                <div className="border-t p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-10 w-10 shrink-0">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={userInitial} className="object-cover" />}
                      <AvatarFallback className="atelier-avatar font-semibold">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground break-all leading-tight">{userEmail}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Free Plan</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-center gap-2"
                    onClick={() => setLogoutOpen(true)}
                    disabled={isPending}
                  >
                    {isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <LogOut className="h-4 w-4" />}
                    {isPending ? "Signing out…" : "Sign out"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Logout scope dialog ── */}
        <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Sign out</DialogTitle>
              <DialogDescription>
                Sign out of this device only, or end all active sessions across every device.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => handleSignOut("global")}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                Sign out of all devices
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleSignOut("local")} disabled={isPending}>
                This device only
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setLogoutOpen(false)} disabled={isPending}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── Public navbar (landing, legal, contact pages) ─────────────────────────────
  return (
    <nav className="sticky top-0 z-50 w-full border-b backdrop-blur-md atelier-nav">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-xl atelier-nav-logo">Jobnest</span>
        </Link>

        <div className="hidden sm:flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" disabled={isPending}>Dashboard</Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogoutOpen(true)}
                disabled={isPending}
                className="gap-2"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                {isPending ? "Signing out…" : "Sign out"}
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="shadow-sm">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        <div className="sm:hidden flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            className="p-2 -mr-2 rounded-md hover:bg-muted/50 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-border/20 bg-background dark:bg-black px-4 py-4 space-y-2">
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" className="block">
                <Button variant="ghost" className="w-full justify-start" disabled={isPending}>Dashboard</Button>
              </Link>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setLogoutOpen(true)}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                {isPending ? "Signing out…" : "Sign out"}
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="block">
                <Button variant="ghost" className="w-full justify-start">Log in</Button>
              </Link>
              <Link href="/signup" className="block">
                <Button className="w-full">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      )}

      {/* ── Logout scope dialog (public navbar) ── */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign out</DialogTitle>
            <DialogDescription>
              Sign out of this device only, or end all active sessions across every device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => handleSignOut("global")}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
              Sign out of all devices
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleSignOut("local")} disabled={isPending}>
              This device only
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setLogoutOpen(false)} disabled={isPending}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
