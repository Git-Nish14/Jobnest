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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px] sm:h-[500px] sm:w-[500px]" />

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary sm:px-4 sm:text-sm">
              <Zap className="mr-1.5 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
              Free Job Application Tracker
            </div>

            <h1 className="mt-6 max-w-4xl text-3xl font-bold tracking-tight sm:mt-8 sm:text-4xl md:text-5xl lg:text-6xl">
              Stop Losing Track of Your{" "}
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Job Applications
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg md:text-xl">
              The simple, powerful way to organize your job search. Track every application,
              manage documents, and land your dream job faster.
            </p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:gap-4">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 text-base sm:w-auto">
                  Start Tracking — It's Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Sign In
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-muted-foreground sm:mt-12 sm:gap-x-8 sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                No credit card required
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Free forever
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Secure & private
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="grid grid-cols-2 gap-4 sm:gap-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-primary sm:text-3xl lg:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
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
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:mt-4 sm:text-base lg:text-lg">
            Get started in minutes with our simple four-step process
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:mt-16 sm:gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-8 hidden h-0.5 w-full -translate-x-1/2 bg-gradient-to-r from-primary/50 to-transparent lg:block" />
              )}
              <div className="relative flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground sm:h-16 sm:w-16 sm:text-xl">
                  {step.number}
                </div>
                <h3 className="mt-4 text-base font-semibold sm:mt-6 sm:text-lg">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Everything You Need to Succeed
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:mt-4 sm:text-base lg:text-lg">
              Powerful features designed to streamline your job search
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:mt-16 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group relative rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:border-primary/50 hover:shadow-md sm:p-6 lg:p-8"
                >
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20 sm:mb-4 sm:h-12 sm:w-12">
                    <Icon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
                  </div>
                  <h3 className="text-base font-semibold sm:text-lg">{feature.title}</h3>
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
        <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-primary/5 p-6 text-center sm:p-12 lg:p-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center">
            <div className="flex -space-x-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-xs font-medium text-primary sm:h-10 sm:w-10"
                >
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              ))}
            </div>
            <h3 className="mt-4 text-lg font-semibold sm:mt-6 sm:text-xl lg:text-2xl">
              Join Job Seekers Who Stay Organized
            </h3>
            <p className="mt-2 text-sm text-muted-foreground sm:mt-4 sm:text-base">
              Stop using spreadsheets and sticky notes. Start tracking your applications
              the smart way and increase your chances of landing your dream job.
            </p>
            <div className="mt-6 flex items-center gap-1 sm:mt-8">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className="h-4 w-4 fill-yellow-400 text-yellow-400 sm:h-5 sm:w-5"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                Built for job seekers, by job seekers
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/50">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Ready to Take Control of Your Job Search?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:mt-4 sm:text-base lg:text-lg">
            Create your free account today and never lose track of an application again.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:mt-10 sm:flex-row sm:justify-center">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required • Free forever • Takes 30 seconds
          </p>
        </div>
      </section>

    </LayoutWrapper>
  );
}
