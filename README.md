# Jobnest — Job Application Tracker

A modern, secure platform to organise and manage your entire job search. Built with Next.js 16, Supabase, and TypeScript.

**Live:** [jobnest.nishpatel.dev](https://jobnest.nishpatel.dev) · **By [Nish Patel](https://nishpatel.dev)**

> Found a bug or have a suggestion? [Open an issue](https://github.com/Git-Nish14/Jobnest/issues) · [View on GitHub](https://github.com/Git-Nish14/Jobnest)

---

## Features

### Authentication & Security
- Email/Password with **6-digit OTP verification** (Nodemailer, not Supabase Auth emails)
- **Google & GitHub OAuth** — `/auth/callback` exchanges code and sets session
- **Age verification + Terms acceptance** — required at signup before email or OAuth proceeds
- **Stay signed in 30 days** — `sb_rm=1` persistent; unchecked = session-only via `sessionStorage`; `__Host-` cookie prefix in production
- **Cross-tab logout sync** — `AuthSync` listens to `onAuthStateChange`
- **Auto-redirect** — authenticated users bounce from auth pages to `/dashboard`
- Protected routes via Next.js 16 `proxy.ts` + Supabase SSR session refresh
- HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy headers
- Redis-backed rate limiting (Upstash); dual-layer on send-otp (IP + per-email)
- SHA-256 hashed OTPs with timing-safe comparison

### Profile Page
- Display name, About Me (bio), NESTAi Context (AI-specific instructions)
- **Work Authorization** — US visa status dropdown (8 options); shown as sidebar badge; injected into NESTAi system prompt
- **Notifications** — toggle: overdue reminders, weekly digest, re-engagement emails
- **Change / Set password** — 3-step OTP-verified; OAuth users can add a password
- **Delete account** — OTP-confirmed soft delete, 30-day grace period
- **GDPR data export** — all personal data as dated JSON (rate-limited 3/day)
- **Billing portal** — Stripe customer portal for Pro subscribers

### Account Deletion (Grace Period)
1. OTP-confirmed deletion request
2. Scheduled 30 days out; account stays fully accessible
3. 7-day reminder emails, 24h final warning email
4. Daily cron permanently erases after 30 days (RLS cascade)
5. Right-to-erasure verification — queries 9 tables for orphaned rows post-deletion

### Dashboard
- Stats: total applications, this week/month, active pipeline, offers
- Weekly bar chart, status distribution chart, upcoming interviews, pending reminders
- **Quick-access cards** — Document Library + ATS Scanner directly on dashboard
- Recent applications list
- **Search Intelligence** — three insight cards derived from existing data (no extra DB queries): avg days to first response (90-day capped proxy), interview-to-offer conversion rate (≥3 threshold), ghosting rate (≥5 threshold); colour-coded positive/neutral/warning tones with actionable context

### Applications
- Full CRUD with status: Applied, Phone Screen, Interview, Offer, Rejected, Withdrawn, **Ghosted**
- **Job description field** — paste full JD to power ATS scan + NESTAi tailoring
- **"Import from job posting"** — paste a URL or raw JD text; Groq extracts company, role, location, salary range, and description and auto-fills the form; URL fetch is SSRF-protected (DNS pre-resolution + post-redirect IP check)
- **Source tracking** — 11 sources (LinkedIn, Indeed, Referral, Company Website…)
- **Application completeness score** — 10-field ring on list cards (visual only); full interactive checklist on detail page (auto-refreshes on tab focus)
- **ATS score badge** — persisted to DB after each scan; shown in bottom meta row
- **Status Journey** — visual stepper on application detail showing days spent at each status stage; horizontal on desktop, vertical on mobile; derived from activity logs (zero extra DB queries)
- Filter by status, location, date range; sort by date/company/position
- Export to CSV or JSON; kanban board view toggle

### ATS Scanner (`/ats`)
- Upload any resume (PDF/DOCX/TXT/MD) + paste a job description
- **5 AI providers** — Groq (Llama 3.3 70B), OpenAI (GPT-4o mini), Anthropic (Claude Haiku 4.5), Google (Gemini 1.5 Flash), Perplexity (Sonar Small); UI shows only configured providers
- Server-side keyword overlap pre-computation anchors AI score to real data (no "always 82" bias)
- Returns: match score 0–100, missing keywords, matched keywords, improvement suggestions
- **Continue in NESTAi** — pre-fills NESTAi input with contextual follow-up message

### Document Library (`/documents`)
- All documents in one place: library uploads + application-linked files
- **1 GB quota** with colour-coded progress bar
- Filter by type (PDF/DOCX/Image/Text) and origin (Library/Applications)
- **Inline preview popup** — PDF iframe, image viewer, download + open-in-tab
- **Delete gated by origin** — library docs: delete button; app-linked docs: lock icon (manage from application)
- **ATS Scan button** on each compatible document card → `/ats?doc_id=`
- Upload, URL import, version history, restore, purge old versions
- **Virus scanned on upload** — Cloudmersive multi-engine AV (fail-open when key absent)
- Shareable links (1d/7d/30d expiry) with view count analytics
- Magic-byte server-side content validation on all uploads

### Interviews
- Schedule per application; types: Phone Screen, Technical, Behavioral, On-site, Final
- Round tracking, duration, meeting URL, interviewer names, pre/post notes
- Status: Scheduled, Completed, Cancelled, Rescheduled

### Contacts
- Recruiters and hiring managers with company, email, phone, LinkedIn, notes
- Mark primary contacts; associate with applications

### Reminders
- Manual and **auto-generated cadence** (Day 7, 14, 21 for Applied/Phone Screen apps)
- Types: Follow Up, Interview, Deadline; mark complete; overdue detection
- **Re-engagement emails** — automated email to users inactive 14+ days (30-day cooldown, opt-out in profile)

### Email Templates
- Reusable templates by category; variable placeholders (`{{company}}`, `{{position}}`)
- One-click copy

### Salary Tracker
- Base salary, bonus, signing bonus, equity, benefits per application
- Multi-currency; comparison across all offers

### NESTAi — AI Job Search Assistant
- ChatGPT-style interface; full access to applications, interviews, reminders, contacts, salary, documents
- **Streaming responses** with stop button; markdown rendering; suggested follow-ups
- **Work authorization aware** — user's visa status injected into system prompt
- **File attachments** — PDF, DOCX, TXT, MD, images up to 5 MB; binary stored to Supabase Storage; inline preview (PDF iframe · image · extracted text) with download button via 10-min signed URL
- **Interview Prep** — "Prep" button opens a modal; pick an active application → 5 tailored STAR behavioral questions generated from the stored JD; provide draft answers for specific AI feedback
- **Model fallback** — primary `llama-3.3-70b-versatile`; auto-falls back to `llama-3.1-8b-instant` on Groq 429/5xx; amber "reduced capacity" banner shown to user
- Pin chats, edit messages, rename/delete sessions with confirm dialog
- Rate limits: 5 req/min free · 30 req/min Pro; live counter with countdown and progress bar
- Smart context trimming (4-step, 124,500-token budget); 100-message history
- **NESTAi handoff from ATS** — sessionStorage pre-fills input after a scan

### Notifications
- Bell polls every 60s; badge caps at 99+; popover with quick links
- `/notifications` page — All/Unread/Read tabs, bulk mark-read/clear, cursor pagination
- Daily cron: in-app notifications for overdue reminders + upcoming interviews (24h window)
- Idempotent via `(user_id, source_type, source_id)` partial unique index

### Billing & Payments (Stripe)
- Checkout, 4 webhook events, billing portal, dunning email, 30-day trial, annual toggle
- Plan enforcement fail-closed (reads `subscriptions` via service-role, returns "free" on DB error)
- Student discount — server-side `.edu` allow-list (16 academic TLDs)
- Mid-cycle proration for monthly ↔ annual switch

### SEO & GEO
- **JSON-LD** — `SoftwareApplication`, `WebSite` (SearchAction), `FAQPage` on landing; `Product`+`Offer` on pricing
- **llms.txt** — plain-English site description for ChatGPT, Perplexity, Google AI, Claude
- Per-page `openGraph` + `twitter` metadata on all 6 public pages
- Sitemap auto-generated at `/sitemap.xml` via `app/sitemap.ts`
- `robots.txt` with all authenticated routes disallowed

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router, Turbopack) |
| Language | TypeScript 5.9 |
| Database | Supabase (PostgreSQL + RLS) |
| Storage | Supabase Storage |
| Auth | Custom OTP via Nodemailer + Supabase Auth (email + Google/GitHub OAuth) |
| AI — NESTAi | Groq (`llama-3.3-70b-versatile`) |
| AI — ATS Scanner | Groq, OpenAI, Anthropic, Google Gemini, Perplexity |
| Email | Nodemailer (SMTP) |
| Billing | Stripe (checkout, webhooks, portal, dunning) |
| Virus scanning | Cloudmersive (multi-engine AV, fail-open) |
| Rate limiting | Upstash Redis (falls back to in-memory) |
| Styling | Tailwind CSS 4 + dark mode — Intellectual Atelier design system |
| UI | Radix UI primitives + custom atelier-themed components |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Cron | Vercel Cron Jobs |
| Testing | Vitest (588 tests, 50 files) |

---

## Project Structure

```
web/
├── app/
│   ├── (auth)/                   # Login, signup, forgot-password
│   ├── (dashboard)/              # Protected dashboard pages
│   │   ├── dashboard/
│   │   ├── applications/         # List + [id] detail + [id]/edit + new
│   │   ├── ats/                  # ATS Scanner (server component, pre-fetches docs)
│   │   ├── documents/            # Document Library
│   │   ├── interviews/
│   │   ├── reminders/
│   │   ├── contacts/
│   │   ├── templates/
│   │   ├── salary/
│   │   ├── nestai/
│   │   ├── notifications/
│   │   └── profile/
│   ├── (public)/                 # Public pages (shared LandingHeader + LandingFooter)
│   │   ├── page.tsx              # Landing page with JSON-LD structured data
│   │   ├── pricing/              # Pricing page with JSON-LD Product schema
│   │   ├── privacy/
│   │   ├── terms/
│   │   ├── contact/
│   │   └── cookies/
│   ├── api/
│   │   ├── auth/                 # send-otp, verify-otp, reset-password
│   │   ├── profile/              # update-name, change-password, update-about-me,
│   │   │                         # update-nestai-context, update-notifications,
│   │   │                         # update-work-authorization, delete-account,
│   │   │                         # reactivate-account, verify-change-otp,
│   │   │                         # export-data (GDPR), complete-onboarding
│   │   ├── cron/
│   │   │   ├── process-deletions/    # Daily 09:00 UTC
│   │   │   ├── overdue-reminders/    # Daily 09:00 UTC
│   │   │   ├── weekly-digest/        # Mondays 08:00 UTC
│   │   │   ├── follow-up-reminders/  # Daily 09:00 UTC — Day 7/14/21 auto-reminders
│   │   │   └── re-engagement/        # Daily 10:00 UTC — 14-day inactivity emails
│   │   ├── documents/            # list, upload, [id], ats-scan, import-url, share, shared, refresh-url
│   │   ├── health/               # Liveness + readiness probe
│   │   ├── applications/
│   │   │   └── parse-jd/         # POST — JD URL/text → structured fields (SSRF-protected)
│   │   ├── nesta-ai/             # Chat (streaming), sessions, messages, parse-file,
│   │   │                         # attachment-url (signed URL for chat file preview)
│   │   ├── notifications/
│   │   ├── stripe/               # checkout, webhook, portal, student-verify, update-subscription
│   │   └── contact/
│   ├── sitemap.ts                # Auto-generates /sitemap.xml (8 public pages)
│   └── opengraph-image.tsx       # 1200×630 OG image
├── components/
│   ├── ui/
│   ├── applications/             # ApplicationCard (completeness ring), CompletenessCard, CompletenessRing
│   ├── ats/                      # ATSScanner client component
│   ├── auth/
│   ├── common/
│   ├── dashboard/
│   ├── documents/                # DocumentManager
│   ├── layout/                   # Navbar, BottomTabBar, NotificationBell, ThemeToggle
│   └── profile/                  # ProfileClient, DeletionBanner
├── lib/
│   ├── api/
│   ├── auth/                     # plan.ts — fail-closed plan enforcement
│   ├── email/                    # Nodemailer — all email types
│   ├── notifications/
│   ├── security/                 # OTP, rate-limit (Redis), CSRF, virus-scan (Cloudmersive)
│   ├── utils/
│   │   ├── completeness.ts       # Application completeness scoring (10 fields, 0–10)
│   │   ├── document-parser.ts    # PDF/DOCX/TXT extraction
│   │   ├── fetch-retry.ts
│   │   └── storage.ts
│   ├── env.ts                    # Startup env validation
│   └── validations/              # Zod schemas
├── services/
├── config/                       # Constants (APPLICATION_STATUSES, APPLICATION_SOURCES, WORK_AUTHORIZATION_OPTIONS)
├── types/
├── public/
│   ├── llms.txt                  # LLM-readable site description (GEO)
│   └── robots.txt
├── vercel.json                   # 5 cron job schedules
└── proxy.ts                      # Route protection + security headers

supabase/
└── migrations/                   # SQL migration files (run in order, 000 → 022)
```

---

## Getting Started

### Prerequisites

- Node.js 18+, npm
- Supabase project
- SMTP server (OTP + lifecycle emails)
- Groq API key (NESTAi — required)
- Stripe account (billing — optional, degrades gracefully)
- Upstash Redis (rate limiting — optional, falls back to in-memory)
- Cloudmersive API key (virus scanning — optional, skipped when absent)
- Google / GitHub OAuth credentials (optional)

### Environment Variables

Copy `web/.env.local.example` to `web/.env.local`. Key variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App URLs
NEXT_PUBLIC_SITE_URL=https://jobnest.nishpatel.dev
NEXT_PUBLIC_APP_URL=https://jobnest.nishpatel.dev

# Security (generate with: openssl rand -hex 32)
CSRF_SECRET=...
CRON_SECRET=...

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
CONTACT_EMAIL=contact@yourdomain.com

# AI — NESTAi (required) + ATS Scanner providers (optional)
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-...        # optional
ANTHROPIC_API_KEY=sk-ant-... # optional
GEMINI_API_KEY=...           # optional
PERPLEXITY_API_KEY=pplx-...  # optional

# Virus scanning (optional — 800 free scans/month)
CLOUDMERSIVE_API_KEY=...

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...

# Redis (optional)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

See `web/.env.local.example` for all variables with descriptions and a setup checklist.

### Database Setup

Run migrations in order from `supabase/migrations/` via the Supabase SQL editor:

| # | File | Purpose |
|---|---|---|
| 00 | `...000_initial_schema.sql` | `job_applications` table + RLS |
| 01 | `...001_storage_setup.sql` | Storage bucket |
| 02 | `...002_security_functions.sql` | Security helpers |
| 03 | `...003_enhanced_features.sql` | Tags, salary, contacts, reminders, templates |
| 04 | `...004_otp_codes.sql` | OTP table |
| 05 | `...005_chat_history.sql` | NESTAi sessions + messages |
| 06 | `...006_pending_deletions.sql` | Soft-delete |
| 07 | `...007_pending_deletions_improvements.sql` | Audit columns, OTP purposes |
| 08 | `...008_chat_pin.sql` | Pin chats |
| 09 | `...009_chat_message_metadata.sql` | File attachment metadata |
| 10 | `...010_subscriptions.sql` | Stripe billing |
| 11–15 | Rate limits, RLS fixes, index cleanup | Performance + security |
| 16 | `...016_application_documents.sql` | Document versioning table |
| 17 | `...017_storage_expanded_mime.sql` | Extended MIME types |
| 18 | `...018_per_app_rls.sql` | Per-application Storage RLS |
| 19 | `...019_activity_logs.sql` | Activity timeline |
| 20 | `...020_notifications.sql` | Notifications table |
| 21 | `...021_ats_fields.sql` | `job_description`, `source`, Ghosted/Withdrawn statuses |
| 22 | `...022_ats_score.sql` | `ats_score` column |

### Installation

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Scripts

```bash
npm run dev           # Development server (Turbopack)
npm run build         # Production build
npm run start         # Production server
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm test              # Vitest (588 tests, 50 files)
npm run test:coverage # Coverage report
```

---

## Testing

All tests run with **Vitest** — no browser or external service required. All dependencies mocked.

| Suite | Location | Coverage |
|---|---|---|
| Unit | `tests/unit/` | lib utilities, all API route handlers (incl. parse-jd SSRF suite, attachment-url ownership checks, parse-file sessionId + storage), analytics metrics (averageTimeToResponse/interviewToOfferRate/ghostRate thresholds), buildStages() status timeline computation, proxy logic |
| Mobile/UX | `tests/unit/mobile/` | Responsive layout, aria labels, CSS tokens |
| E2E flows | `tests/flows/` | Login, signup, forgot-password, change-password, delete+reactivate, NESTAi chat+upload+model-fallback, Stripe billing |

---

## Security

| Feature | Detail |
|---|---|
| OTP | SHA-256 hashed, timing-safe comparison, 5 purposes |
| Rate limiting | Redis-backed (Upstash); dual-layer on send-otp (IP + per-email) |
| Virus scanning | Cloudmersive multi-engine AV on all uploads + URL imports (fail-open) |
| Magic bytes | Server-side content validation prevents extension spoofing |
| CSRF | `SameSite=Lax` + `verifyOrigin()` on all profile mutation routes, parse-file, and parse-jd |
| SSRF | `assertSafeUrl()` on parse-jd: DNS pre-resolution blocks loopback, RFC-1918, link-local (AWS/GCP metadata), CGNAT; post-redirect check prevents open-redirect chains |
| Path traversal | `session_id` validated as UUID before use in Storage path; `..` segments rejected in attachment-url before signed-URL generation |
| Cron auth | `Authorization: Bearer <CRON_SECRET>` — fail-closed |
| RLS | All tables enforce row-level security via `auth.uid()` |
| Plan enforcement | Reads `subscriptions` via service-role — fail-closed, never grants Pro on error |
| Document serving | `Content-Disposition: attachment` forced — prevents stored XSS |
| Startup validation | `instrumentation.ts` throws on missing required env vars |
| Headers | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |

---

## Deployment

### Vercel

1. Push to GitHub → import project (root: `web/`)
2. Add all environment variables
3. Deploy

`vercel.json` schedules 5 cron jobs automatically:

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/process-deletions` | Daily 09:00 UTC | Grace-period deletion |
| `/api/cron/overdue-reminders` | Daily 09:00 UTC | In-app notifications + emails |
| `/api/cron/weekly-digest` | Mondays 08:00 UTC | Digest email |
| `/api/cron/follow-up-reminders` | Daily 09:00 UTC | Day 7/14/21 auto-reminders |
| `/api/cron/re-engagement` | Daily 10:00 UTC | 14-day inactivity emails |

**`CRON_SECRET` must be set** — all cron endpoints return 401 without it.

---

## Contributing / Issues

Found a bug? [Open an issue on GitHub](https://github.com/Git-Nish14/Jobnest/issues).

---

## License

Private — All rights reserved

---

Built by [Nish Patel](https://nishpatel.dev)
