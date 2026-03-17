import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  FileText,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Search,
  Bell,
  Shield,
  Zap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";

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
      title: "Application Tracking",
      description:
        "Log company details, position, salary expectations, and application status in one centralized location.",
    },
    {
      icon: Briefcase,
      title: "Document Management",
      description:
        "Store and organize resumes, cover letters, and other documents for each application.",
    },
    {
      icon: BarChart3,
      title: "Progress Analytics",
      description:
        "Visualize your job search with insightful statistics and track your application success rate.",
    },
    {
      icon: Bell,
      title: "Status Updates",
      description:
        "Keep track of interview stages, follow-ups, and important deadlines for each opportunity.",
    },
    {
      icon: Search,
      title: "Quick Search",
      description:
        "Find any application instantly with powerful search and filtering capabilities.",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description:
        "Your data is encrypted and securely stored. Only you have access to your information.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Create Your Account",
      description: "Sign up in seconds with just your email. No credit card required.",
    },
    {
      number: "02",
      title: "Add Applications",
      description: "Log each job application with company details, position, and status.",
    },
    {
      number: "03",
      title: "Track Progress",
      description: "Update statuses, add notes, and monitor your job search journey.",
    },
    {
      number: "04",
      title: "Land Your Dream Job",
      description: "Stay organized and focused until you secure the perfect opportunity.",
    },
  ];

  const stats = [
    { value: "100%", label: "Free Forever" },
    { value: "5min", label: "Setup Time" },
    { value: "24/7", label: "Access Anywhere" },
    { value: "∞", label: "Applications" },
  ];

  return (
    <LayoutWrapper footerVariant="full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:40px_40px] opacity-50" />
        <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-primary/8 blur-[120px]" />

        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary tracking-wide uppercase">
              <Zap className="h-3 w-3" />
              Free Job Application Tracker
            </div>

            <h1 className="mt-8 max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Organize your job search.{" "}
              <span className="bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent">
                Land faster.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
              Track every application, manage documents, and stay on top of interviews — all in one clean, free workspace.
            </p>

            <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 px-7 shadow-md hover:shadow-lg transition-shadow sm:w-auto">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-7">
                  Sign In
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No credit card required", "Free forever", "Secure & private"].map((text) => (
                <div key={text} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary sm:text-4xl tabular-nums">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">How it works</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Up and running in minutes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground sm:text-base">
            A simple four-step process to take control of your job search
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:mt-16 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-6 hidden h-px w-full bg-gradient-to-r from-border to-transparent lg:block" />
              )}
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md">
                {step.number}
              </div>
              <h3 className="mt-4 text-sm font-semibold sm:text-base">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Features</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Everything you need to succeed
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground sm:text-base">
              Powerful tools designed to streamline your entire job search
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group rounded-xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 sm:p-6"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-blue-50/50 p-8 text-center sm:p-12 lg:p-16">
          <div className="mx-auto flex max-w-2xl flex-col items-center">
            <div className="flex -space-x-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary/10 text-primary sm:h-10 sm:w-10"
                >
                  <Users className="h-4 w-4" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="h-4 w-4 fill-amber-400" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <h3 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
              Built for job seekers, by job seekers
            </h3>
            <p className="mt-3 text-muted-foreground sm:text-base leading-relaxed">
              Stop juggling spreadsheets and sticky notes. Jobnest keeps every application, interview, and follow-up organized in one place so you can focus on what matters — getting hired.
            </p>
            <Link href="/signup" className="mt-8">
              <Button size="lg" className="gap-2 shadow-md">
                Start for free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-primary">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Ready to take control of your job search?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
            Create your free account today and never lose track of an application again.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full gap-2 sm:w-auto font-semibold shadow-sm">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-primary-foreground/60">
            No credit card required · Free forever · Takes 30 seconds
          </p>
        </div>
      </section>

    </LayoutWrapper>
  );
}
