"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Github } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FooterProps {
  variant?: "full" | "simple";
}

export function Footer({ variant = "simple" }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (variant === "full") {
    return (
      <footer className="border-t bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">
                <Image
                  src="/logo_1.png"
                  alt="Jobnest Logo"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                />
                <span className="font-semibold">Jobnest</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                The simple, powerful way to organize your job search and land
                your dream job.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                A{" "}
                <a
                  href="https://techifive.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Techifive
                </a>{" "}
                Product
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold text-sm">Product</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {isAuthenticated ? (
                  <>
                    <li>
                      <Link
                        href="/dashboard"
                        className="transition-colors hover:text-foreground"
                      >
                        Dashboard
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/applications"
                        className="transition-colors hover:text-foreground"
                      >
                        Applications
                      </Link>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link
                        href="/signup"
                        className="transition-colors hover:text-foreground"
                      >
                        Get Started
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/login"
                        className="transition-colors hover:text-foreground"
                      >
                        Sign In
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <Link
                    href="/contact"
                    className="transition-colors hover:text-foreground"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-sm">Legal</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="/privacy"
                    className="transition-colors hover:text-foreground"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="transition-colors hover:text-foreground"
                  >
                    Terms of Use
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company & Support */}
            <div>
              <h4 className="font-semibold text-sm">Support</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="https://techifive.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-foreground"
                  >
                    Techifive
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/techifive"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-foreground inline-flex items-center gap-1"
                  >
                    <Github className="h-3 w-3" />
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t pt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-muted-foreground sm:text-sm">
              © {currentYear}{" "}
              <a
                href="https://techifive.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-foreground transition-colors"
              >
                Techifive
              </a>
              . All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/techifive"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // Simple footer for internal pages
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image
              src="/logo_1.png"
              alt="Jobnest Logo"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="text-sm font-medium">Jobnest</span>
            <span className="text-xs text-muted-foreground">
              — A{" "}
              <a
                href="https://techifive.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Techifive
              </a>{" "}
              Product
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link
              href="/contact"
              className="transition-colors hover:text-foreground"
            >
              Contact
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <a
              href="https://github.com/techifive"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground inline-flex items-center gap-1"
            >
              <Github className="h-3 w-3" />
              GitHub
            </a>
          </div>
        </div>
        <div className="mt-4 text-center text-xs text-muted-foreground sm:text-left">
          © {currentYear}{" "}
          <a
            href="https://techifive.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-foreground transition-colors"
          >
            Techifive
          </a>
          . All rights reserved.
        </div>
      </div>
    </footer>
  );
}
