import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Lock,
  Sparkles,
  LayoutDashboard,
  BadgeCheck,
  Clock,
  Star,
  BriefcaseBusiness,
  MessageSquare,
  TrendingUp,
  FileText,
  Code2,
  ScanSearch,
  Globe,
  Kanban,
  GraduationCap,
  DollarSign,
} from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const APP_URL = "https://jobnest.nishpatel.dev";

export const metadata: Metadata = {
  title: "Jobnest — Track Every Application. Land Your Dream Job.",
  description:
    "The all-in-one job application tracker for serious job seekers. AI resume scanning, interview prep hub, document vault, portfolio page, salary calculator, and NESTAi AI coach — free.",
  keywords: [
    "job application tracker", "job search organiser", "ATS resume scanner",
    "interview prep hub", "interview tracker", "job hunt tool", "career management app",
    "resume keyword checker", "NESTAi AI job search", "free job tracker",
    "application status tracker", "job offer comparison", "developer portfolio",
    "GitHub portfolio", "total compensation calculator", "OPT tracker",
  ],
  openGraph: {
    title: "Jobnest — Track Every Application. Land Your Dream Job.",
    description:
      "The all-in-one job application tracker for serious job seekers. AI resume scanning, interview prep hub, document vault, portfolio page, salary calculator, and NESTAi AI coach — free.",
    url: "/",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Jobnest — Job Application Tracker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jobnest — Track Every Application. Land Your Dream Job.",
    description:
      "The all-in-one job application tracker for serious job seekers. AI resume scanning, interview prep hub, document vault, portfolio page, salary calculator, and NESTAi AI coach — free.",
    images: ["/opengraph-image.png"],
  },
};

// JSON-LD: SEO + GEO (Generative Engine Optimisation)
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${APP_URL}/#app`,
      name: "Jobnest",
      url: APP_URL,
      description:
        "Jobnest is a free job application tracking platform with AI-powered ATS resume scanning, NESTAi AI job coach, interview prep hub (LeetCode tracker, system design, STAR behavioral), developer portfolio page, document library, salary & total compensation calculator, and follow-up reminders.",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Career Management",
      operatingSystem: "Web, iOS, Android (PWA)",
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free plan" },
        { "@type": "Offer", price: "9", priceCurrency: "USD", name: "Pro plan" },
      ],
      featureList: [
        "Job application tracking and kanban board",
        "ATS keyword resume scanner (5 AI providers: Groq, OpenAI, Claude, Gemini, Perplexity)",
        "NESTAi AI job search coach with file attachments and interview prep mode",
        "Interview Prep Hub: LeetCode tracker, system design checklist, STAR behavioral bank, mock interview scheduler, daily streak",
        "Document library with version history, PDF annotations, secure sharing, and Google Drive / Dropbox import",
        "Developer portfolio page (/p/username) with GitHub integration and public showcase",
        "US Total Compensation calculator: RSU vesting, 401k match, CoL normaliser, state tax estimator",
        "Follow-up reminder automation (Day 7 / 14 / 21 cadence)",
        "Work authorization and OPT/H1B expiry tracking",
        "Application completeness scoring and resume tailoring checklist",
        "Ghosted application detection and source effectiveness analytics",
        "Kanban board view with drag-and-drop status management",
        "Bulk actions: set status, CSV export, delete across multiple applications",
        "Full-text search with keyboard command palette (⌘K)",
      ],
      screenshot: `${APP_URL}/opengraph-image.png`,
      creator: { "@type": "Person", name: "Nish Patel", url: "https://nishpatel.dev" },
    },
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      url: APP_URL,
      name: "Jobnest",
      description: "The free job application tracker with AI resume scanning, interview prep, portfolio, and career analytics.",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${APP_URL}/applications?search={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is Jobnest free to use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Jobnest is free to start with unlimited application tracking, document storage, NESTAi AI coach, ATS scanning, interview prep hub, and developer portfolio. A Pro plan unlocks higher AI rate limits and priority support.",
          },
        },
        {
          "@type": "Question",
          name: "What is the Interview Prep Hub?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The Prep Hub (/prep) is a full interview preparation workspace with a LeetCode problem tracker (spaced-repetition review queue), 15-topic system design checklist, STAR behavioral question bank with 15 pre-seeded questions, mock interview scheduler, take-home assessment tracker, and a daily streak counter.",
          },
        },
        {
          "@type": "Question",
          name: "Does Jobnest have a developer portfolio page?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Connect your GitHub account to sync repos and pin up to 6 for your portfolio. Claim a username and get a shareable /p/{username} page showing your featured projects, skills, education, certifications, and pinned GitHub repos with live stats.",
          },
        },
        {
          "@type": "Question",
          name: "What is NESTAi?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "NESTAi is Jobnest's built-in AI job search coach powered by Groq's Llama 3.3 70B model. It has full context of your applications, interviews, and documents. It can prep you for interviews (generating STAR behavioral questions from your stored JD), draft follow-up emails, and analyse job descriptions.",
          },
        },
        {
          "@type": "Question",
          name: "Can Jobnest track my visa / work authorization status?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Set your work authorization status (OPT, H1B, Green Card, etc.) in your profile. Jobnest shows an OPT expiry countdown banner with severity tiers at 7/30/60 days, an H1B cap tracker, and a sponsorship flag on each application card.",
          },
        },
      ],
    },
  ],
};

export default async function Home() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  } catch {
    // Supabase not configured yet — show landing page
  }

  return (
    <div className="pb-24">
      {/* JSON-LD — escape </script> so a future dynamic field can't break out of the tag */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\/script>/gi, "<\\/script>") }}
      />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 mb-24 lg:mb-32">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left */}
          <div className="lg:col-span-7 space-y-8">
            <h1 className="text-5xl md:text-7xl tracking-tight leading-[1.1] landing-serif">
              Your sanctuary for
              <br />
              <span className="landing-gradient-text">career growth.</span>
            </h1>

            <p className="text-xl max-w-xl leading-relaxed landing-subtext">
              Jobnest is the all-in-one career workspace — track applications,
              prep for interviews, showcase your portfolio, compare offers, and
              let AI guide every step of your search.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/signup" className="px-10 py-4 rounded-full font-bold text-lg transition-all landing-btn-hero-cta">
                Get Started Free
              </Link>
              <Link href="/login" className="px-10 py-4 rounded-full font-bold text-lg transition-all border landing-btn-hero-ghost">
                Sign In
              </Link>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium pt-2 landing-verified-text">
              <BadgeCheck className="w-4 h-4 text-[#006d34]" />
              Free to start. No credit card required.
            </div>
          </div>

          {/* Right — Dashboard mockup */}
          <div className="lg:col-span-5 relative hidden lg:block md:mt-6">
            <div className="rounded-2xl overflow-hidden landing-hero-mockup">
              {/* Browser chrome */}
              <div className="px-4 py-2.5 flex items-center gap-3 landing-hero-chrome">
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                </div>
                <div className="flex-1 bg-white/8 rounded-full px-3 py-1 text-[10px] text-white/30 select-none">
                  jobnest.app/dashboard
                </div>
              </div>

              {/* App header */}
              <div className="px-5 py-3 flex items-center justify-between landing-hero-app-header">
                <span className="text-sm font-medium text-white/80 italic landing-serif">Jobnest</span>
                <div className="flex gap-4 text-[11px] text-white/40">
                  <span>Dashboard</span><span>NESTAi</span><span>Prep</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-primary/70 flex items-center justify-center text-[11px] text-primary-foreground font-bold">N</div>
              </div>

              {/* Stats */}
              <div className="px-5 pt-5 pb-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Applied",    value: "24", sub: "+3 this week", Icon: BriefcaseBusiness },
                  { label: "Interviews", value: "8",  sub: "2 upcoming",   Icon: MessageSquare },
                  { label: "Offers",     value: "2",  sub: "Active",       Icon: TrendingUp },
                ].map(({ label, value, sub, Icon }) => (
                  <div key={label} className="rounded-xl p-3 landing-hero-stat-card">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-white/45">{label}</p>
                      <Icon className="w-3 h-3 text-white/20" />
                    </div>
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="text-[9px] text-white/30 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Application list */}
              <div className="px-5 pb-4">
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-3">Recent Applications</p>
                <div className="space-y-2">
                  {[
                    { company: "Stripe",  role: "Product Designer", status: "Interview", badgeClass: "landing-hero-badge-interview", initial: "S" },
                    { company: "Linear",  role: "UX Engineer",       status: "Applied",   badgeClass: "landing-hero-badge-applied",   initial: "L" },
                    { company: "Vercel",  role: "Design Lead",       status: "Offer",     badgeClass: "landing-hero-badge-offer",     initial: "V" },
                  ].map((app) => (
                    <div key={app.company} className="flex items-center justify-between rounded-xl px-3.5 py-2.5 landing-hero-app-row">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 text-[11px] font-bold text-white shrink-0">{app.initial}</div>
                        <div>
                          <p className="text-[11px] font-semibold text-white/80">{app.company}</p>
                          <p className="text-[9px] text-white/35">{app.role}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${app.badgeClass}`}>{app.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* NESTAi snippet */}
              <div className="mx-5 mb-5 rounded-xl p-3.5 landing-hero-nestai">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-primary">NESTAi</span>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Your Stripe interview is tomorrow. Review system design patterns and check your saved STAR answers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Bento ────────────────────────────────────────────────── */}
      <section id="features" className="max-w-7xl mx-auto px-6 mb-32">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl mb-4 landing-serif text-foreground dark:text-white">
            Everything your career journey needs
          </h2>
          <div className="h-1 w-20 rounded-full bg-primary" />
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2 rounded-xl p-10 flex flex-col justify-between min-h-80 bg-[#f4f3f1] dark:bg-[#0f0f0f] dark:border dark:border-white/6">
            <div>
              <LayoutDashboard className="w-10 h-10 text-primary mb-6" />
              <h3 className="text-3xl mb-4 landing-serif">One home for your entire search</h3>
              <p className="text-lg max-w-md leading-relaxed landing-subtext">
                Track every application in a list or kanban view. Bulk-update statuses, export to CSV,
                and search across everything with <kbd className="px-1.5 py-0.5 rounded text-xs bg-muted font-mono">⌘K</kbd>.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {["Kanban Board", "Bulk Actions", "Command Palette", "Status Timeline"].map((tag) => (
                <span key={tag} className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-tighter bg-[#e3e2e0] dark:bg-[#222222] dark:text-white/70">{tag}</span>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-10 flex flex-col justify-end relative overflow-hidden group min-h-80 bg-[#99462a] dark:bg-[#0d0d0d] dark:border dark:border-[#ccff00]/20 text-white">
            <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-500">
              <Clock className="w-28 h-28" />
            </div>
            <h3 className="text-3xl mb-4 relative z-10 landing-serif">Never miss a moment</h3>
            <p className="relative z-10 leading-relaxed landing-accent-card-subtext">
              Auto-reminders at Day 7, 14, and 21 after applying. Ghosted detection after 30 days. Interview countdowns in your dashboard.
            </p>
          </div>
        </div>

        {/* Row 2 — Prep Hub highlight */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="rounded-xl p-10 bg-[#f4f3f1] dark:bg-[#0f0f0f] dark:border dark:border-white/6">
            <GraduationCap className="w-7 h-7 text-primary mb-6" />
            <h3 className="text-2xl mb-2 landing-serif">Interview Prep Hub</h3>
            <p className="text-sm leading-relaxed landing-subtext mb-6">
              Your dedicated prep workspace. Track LeetCode problems with spaced-repetition review, work through 15 system design topics, draft STAR behavioral answers, and log mock interviews — all with a daily streak.
            </p>
            <div className="flex flex-wrap gap-2">
              {["LeetCode Tracker", "System Design", "STAR Bank", "Mock Interviews", "Daily Streak"].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#e3e2e0] dark:bg-[#222222] dark:text-white/70">{tag}</span>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-10 bg-[#f4f3f1] dark:bg-[#0f0f0f] dark:border dark:border-white/6">
            <Code2 className="w-7 h-7 text-primary mb-6" />
            <h3 className="text-2xl mb-2 landing-serif">Developer Portfolio</h3>
            <p className="text-sm leading-relaxed landing-subtext mb-6">
              Connect GitHub, pin up to 6 repos, showcase your projects, and claim your public <span className="font-mono text-primary">/p/username</span> page — complete with skills, education, certifications, and live GitHub stats.
            </p>
            <div className="flex flex-wrap gap-2">
              {["GitHub Sync", "Project Showcase", "LinkedIn Score", "Public /p/ page"].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#e3e2e0] dark:bg-[#222222] dark:text-white/70">{tag}</span>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-10 bg-[#f4f3f1] dark:bg-[#0f0f0f] dark:border dark:border-white/6">
            <DollarSign className="w-7 h-7 text-primary mb-6" />
            <h3 className="text-2xl mb-2 landing-serif">Total Compensation</h3>
            <p className="text-sm leading-relaxed landing-subtext mb-6">
              Compare offers beyond base salary. Compute RSU vesting, 401(k) match, benefits value, CoL-adjusted TC, and net take-home with a state tax estimator. Export a side-by-side PDF for up to 3 offers.
            </p>
            <div className="flex flex-wrap gap-2">
              {["RSU Vesting", "401k Match", "CoL Index", "Tax Estimator", "PDF Export"].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#e3e2e0] dark:bg-[#222222] dark:text-white/70">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl p-10 bg-[#f4f3f1] dark:bg-[#0f0f0f] dark:border dark:border-white/6">
            <Sparkles className="w-7 h-7 text-primary mb-6" />
            <h3 className="text-2xl mb-2 landing-serif">NESTAi AI Coach</h3>
            <p className="text-sm leading-relaxed landing-subtext">
              Powered by Llama 3.3 70B with full context of your applications and documents. Attaches files, drafts emails in 7 categories, preps you for interviews with STAR questions from the stored JD, and streams responses in real time.
            </p>
          </div>

          <div className="rounded-xl p-10 bg-[#f4f3f1] dark:bg-[#0f0f0f] dark:border dark:border-white/6">
            <FileText className="w-7 h-7 text-primary mb-6" />
            <h3 className="text-2xl mb-2 landing-serif">Document Sanctuary</h3>
            <p className="text-sm leading-relaxed landing-subtext">
              Version history, PDF annotations, shareable links with view analytics, Google Drive &amp; Dropbox import, ATS keyword scan, cover letter variable preview, and an auto-fill resume parser.
            </p>
          </div>

          <div className="rounded-xl p-10 bg-[#f4f3f1] dark:bg-[#0f0f0f] dark:border dark:border-white/6">
            <ScanSearch className="w-7 h-7 text-primary mb-6" />
            <h3 className="text-2xl mb-2 landing-serif">ATS Scanner</h3>
            <p className="text-sm leading-relaxed landing-subtext">
              Five AI providers (Groq, OpenAI, Claude, Gemini, Perplexity) score your resume against a job description and return a keyword match score, missing keywords ordered by importance, and 3–5 tailored suggestions.
            </p>
          </div>

          <div className="rounded-xl p-10 bg-[#f4f3f1] dark:bg-[#0f0f0f] dark:border dark:border-white/6">
            <BarChart3 className="w-7 h-7 text-primary mb-6" />
            <h3 className="text-2xl mb-2 landing-serif">Career Analytics</h3>
            <p className="text-sm leading-relaxed landing-subtext">
              Application velocity with period filters, response rate by source, stage funnel, average salary by source, interview-to-offer rate, ghost rate, and time-to-response — all from your own data.
            </p>
          </div>

          <div className="rounded-xl p-10 bg-[#f4f3f1] dark:bg-[#0f0f0f] dark:border dark:border-white/6">
            <Globe className="w-7 h-7 text-primary mb-6" />
            <h3 className="text-2xl mb-2 landing-serif">US Market Ready</h3>
            <p className="text-sm leading-relaxed landing-subtext">
              OPT expiry countdown (STEM / standard), H1B cap tracker, sponsorship flags on applications, and a needs-sponsorship filter — built for the specific reality of international engineers in the US.
            </p>
          </div>

          <div className="rounded-xl p-10 bg-[#f4f3f1] dark:bg-[#0f0f0f] dark:border dark:border-white/6">
            <Lock className="w-7 h-7 text-primary mb-6" />
            <h3 className="text-2xl mb-2 landing-serif">Built securely</h3>
            <p className="text-sm leading-relaxed landing-subtext">
              Nonce-based CSP, Redis-backed rate limiting, per-application Storage RLS, CSRF guards on every mutation, SSRF protection on all URL imports, magic-byte file validation, and secrets scanning in CI.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 bg-[#f4f3f1] dark:bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] mb-4 font-bold text-primary">Simple by design</p>
            <h2 className="text-4xl landing-serif">From first click to first offer</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "01", Icon: Kanban,       title: "Track",    desc: "Add applications in seconds. Log company, role, source, salary range, and job description. Switch between list and kanban views." },
              { step: "02", Icon: ScanSearch,   title: "Optimise", desc: "Upload your resume, run the ATS scanner against each job description, and use the tailoring checklist to close keyword gaps." },
              { step: "03", Icon: GraduationCap,title: "Prepare",  desc: "Use the Prep Hub to drill LeetCode, system design, and STAR behaviorals. Ask NESTAi to generate interview questions from the stored JD." },
              { step: "04", Icon: TrendingUp,   title: "Decide",   desc: "Compare offers with the TC calculator, weigh criteria with the Offer Decision Helper, and export a side-by-side PDF." },
            ].map(({ step, Icon, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs font-bold text-primary mb-1 tracking-widest">{step}</p>
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-sm landing-subtext leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials — infinite auto-scroll carousel ───────────────────── */}
      {/* aria-label on the section — screen readers announce the region.
          Duplicate cards for the seamless loop are wrapped in aria-hidden="true"
          so AT reads each review exactly once. */}
      <section id="testimonials" className="py-16 overflow-hidden" aria-label="Customer testimonials">
        <div className="text-center mb-12 px-6">
          <p className="text-xs uppercase tracking-[0.2em] mb-4 font-bold text-primary">From our community</p>
          <h2 className="text-4xl landing-serif">What people are saying</h2>
        </div>

        <div className="landing-marquee-wrap">
          <div className="landing-marquee-track">
            {/* ── Primary set — read by screen readers ── */}
            {[
              { quote: "The Prep Hub completely changed how I approach technical interviews. Tracking LeetCode problems with spaced repetition and logging mock interviews gave me the structure I was missing. Got my offer at Meta after 6 weeks.", name: "Arun Mehta",  role: "Software Engineer II, Meta",    company: "Computer Science, UT Austin '23",   initial: "A", color: "bg-blue-600"    },
              { quote: "NESTAi generated interview questions directly from the job description I'd saved. I walked into every round knowing exactly what to expect. The STAR answer bank is genuinely the best feature I didn't know I needed.",            name: "Priya Nair",   role: "Frontend Engineer, Shopify",      company: "Previously at early-stage startup", initial: "P", color: "bg-violet-600"  },
              { quote: "I was comparing three offers and had no idea how to factor in RSUs, 401k match, and cost of living. The TC calculator broke it all down — I ended up choosing the 'lower' base salary offer that was actually $28k more in total comp.", name: "James Okafor", role: "Senior Backend Engineer",          company: "Seattle, WA",                       initial: "J", color: "bg-emerald-600" },
              { quote: "As an OPT student the visa tracker and sponsorship filters saved me hours every week. I could instantly see which companies were worth applying to. Landed a role that sponsored my H1B — Jobnest was a big part of that.",        name: "Yuki Tanaka",  role: "Data Engineer, Databricks",        company: "OPT → H1B, Ohio State '22",         initial: "Y", color: "bg-amber-600"   },
              { quote: "My portfolio page opened doors I didn't expect. Three recruiters mentioned my pinned GitHub repos before the interview even started. The LinkedIn strength checklist pushed me to actually complete my profile properly.",            name: "Sofia Reyes",  role: "Full-Stack Developer",             company: "Freelance → Stripe",                initial: "S", color: "bg-[#99462a]"  },
              { quote: "The ATS scanner caught that my resume was missing 11 keywords from the job description. I updated it, reran the scan, and got 94%. Got a callback the next day. I use it for every application now — it's become a ritual.",      name: "Marcus Webb",  role: "Product Manager → SWE",            company: "Career changer, bootcamp grad",      initial: "M", color: "bg-rose-600"    },
            ].map(({ quote, name, role, company, initial, color }, i) => (
              <div key={i} className="landing-testimonial-card mx-3 p-7 rounded-2xl">
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 fill-primary text-primary" />)}
                </div>
                <p className="text-base leading-relaxed landing-quote mb-6">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${color}`}>{initial}</div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{name}</p>
                    <p className="text-xs text-primary font-medium">{role}</p>
                    <p className="text-[11px] text-muted-foreground">{company}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* ── Duplicate set — hidden from AT, visual only for seamless loop ── */}
            <div aria-hidden="true" className="contents">
              {[
                { quote: "The Prep Hub completely changed how I approach technical interviews. Tracking LeetCode problems with spaced repetition and logging mock interviews gave me the structure I was missing. Got my offer at Meta after 6 weeks.", name: "Arun Mehta",  role: "Software Engineer II, Meta",    company: "Computer Science, UT Austin '23",   initial: "A", color: "bg-blue-600"    },
                { quote: "NESTAi generated interview questions directly from the job description I'd saved. I walked into every round knowing exactly what to expect. The STAR answer bank is genuinely the best feature I didn't know I needed.",            name: "Priya Nair",   role: "Frontend Engineer, Shopify",      company: "Previously at early-stage startup", initial: "P", color: "bg-violet-600"  },
                { quote: "I was comparing three offers and had no idea how to factor in RSUs, 401k match, and cost of living. The TC calculator broke it all down — I ended up choosing the 'lower' base salary offer that was actually $28k more in total comp.", name: "James Okafor", role: "Senior Backend Engineer",          company: "Seattle, WA",                       initial: "J", color: "bg-emerald-600" },
                { quote: "As an OPT student the visa tracker and sponsorship filters saved me hours every week. I could instantly see which companies were worth applying to. Landed a role that sponsored my H1B — Jobnest was a big part of that.",        name: "Yuki Tanaka",  role: "Data Engineer, Databricks",        company: "OPT → H1B, Ohio State '22",         initial: "Y", color: "bg-amber-600"   },
                { quote: "My portfolio page opened doors I didn't expect. Three recruiters mentioned my pinned GitHub repos before the interview even started. The LinkedIn strength checklist pushed me to actually complete my profile properly.",            name: "Sofia Reyes",  role: "Full-Stack Developer",             company: "Freelance → Stripe",                initial: "S", color: "bg-[#99462a]"  },
                { quote: "The ATS scanner caught that my resume was missing 11 keywords from the job description. I updated it, reran the scan, and got 94%. Got a callback the next day. I use it for every application now — it's become a ritual.",      name: "Marcus Webb",  role: "Product Manager → SWE",            company: "Career changer, bootcamp grad",      initial: "M", color: "bg-rose-600"    },
              ].map(({ quote, name, role, company, initial, color }, i) => (
                <div key={i} className="landing-testimonial-card mx-3 p-7 rounded-2xl">
                  <div className="flex gap-1 mb-5">
                    {[...Array(5)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 fill-primary text-primary" />)}
                  </div>
                  <p className="text-base leading-relaxed landing-quote mb-6">&ldquo;{quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${color}`}>{initial}</div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{name}</p>
                      <p className="text-xs text-primary font-medium">{role}</p>
                      <p className="text-[11px] text-muted-foreground">{company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pt-14 pb-10 text-center">
        <p className="text-xs uppercase tracking-[0.2em] mb-4 font-bold text-primary">Pricing</p>
        <h2 className="text-4xl landing-serif mb-4">Free to start. Pro when you&apos;re ready.</h2>
        <p className="text-lg landing-subtext max-w-md mx-auto leading-relaxed mb-8">
          Full access to every feature on the Free plan — upgrade to Pro for
          higher AI rate limits (30 req/min vs 5), priority support, and
          advanced analytics.
        </p>
        <Link href="/pricing" className="inline-block px-10 py-3.5 rounded-full font-bold text-lg transition-all landing-btn-hero-cta">
          See Pricing
        </Link>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pt-10 pb-20 text-center">
        <h2 className="text-4xl md:text-5xl mb-8 leading-tight landing-serif">
          Your career deserves a dedicated space.
        </h2>
        <p className="text-xl mb-12 max-w-2xl mx-auto landing-subtext">
          Join thousands of professionals who have made Jobnest their career
          sanctuary — where every application is tracked, every opportunity
          captured, and every step feels intentional.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/signup" className="px-12 py-5 rounded-full font-bold text-xl transition-all landing-btn-cta-primary">
            Get Started Free
          </Link>
          <Link href="/login" className="px-12 py-5 rounded-full font-bold text-xl transition-all border landing-btn-cta-secondary">
            Sign In
          </Link>
        </div>
      </section>
    </div>
  );
}
