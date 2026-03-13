import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  FileText,
  BarChart3,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    }
  } catch {
    // Supabase not configured yet, show landing page
  }

  const features = [
    {
      icon: FileText,
      title: "Track Everything",
      description:
        "Log company, position, status, salary, and more for each application.",
    },
    {
      icon: Briefcase,
      title: "Store Documents",
      description: "Upload resumes and cover letters for each application.",
    },
    {
      icon: BarChart3,
      title: "Monitor Progress",
      description:
        "Dashboard with stats to see your job search progress at a glance.",
    },
  ];

  const benefits = [
    "Free to use",
    "Secure data storage",
    "Mobile friendly",
    "Dark mode support",
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Briefcase className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">JobTracker</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container flex flex-col items-center justify-center gap-6 py-24 text-center md:py-32">
        <div className="inline-flex items-center rounded-full border bg-muted px-4 py-1.5 text-sm font-medium">
          <span className="mr-2">🚀</span>
          Free job application tracker
        </div>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Track Your Job Applications{" "}
          <span className="text-primary">All in One Place</span>
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          Stay organized during your job search. Track applications, manage
          documents, and monitor your progress with an intuitive dashboard.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              Start Tracking Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Sign In
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-8 text-sm text-muted-foreground">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {benefit}
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to manage your job search
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Simple, powerful features to help you stay organized
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="relative rounded-2xl border bg-card p-8 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/50">
        <div className="container py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Create your free account and start tracking today.
          </p>
          <div className="mt-8">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <span className="font-semibold">JobTracker</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built with Next.js, Tailwind CSS, and Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}
