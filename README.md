# Jobnest - Job Application Tracker

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
- **Nonce-based CSP** — per-request cryptographic nonce injected into `script-src`; `unsafe-eval` removed; `strict-dynamic` enables Next.js code-splitting without whitelisting chunk URLs; fires on HTTPS and `x-forwarded-proto: https` (covers staging behind load balancers)
- HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy headers
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
- **Developer Identity** — Skills (name, category, proficiency, years experience), Certifications (issued/expiry dates, credential URL), Education (institution, degree, GPA opt-in, is_current); full CRUD with Zod validation, CSRF origin check, rate limiting, UUID-guarded deletes, and RLS-enforced ownership
- **Portfolio settings** — claim a username slug (30-day change cooldown enforced server-side; DELETE to remove), toggle public/private, opt-in contact email (defaults off); share URL shown immediately after claiming
- **Profile page structure** — four labelled groups: **Profile** (Display Name · About You · NESTAi Context) / **Career** (Work Authorization) / **Preferences** (Notifications) / **Security** (Password · Danger Zone); sidebar shows exact OAuth providers (Google, GitHub) and correct password status

### Developer Portfolio & Public Profile (`/p/{username}`)
- **GitHub OAuth** — connect GitHub using the same Supabase-configured OAuth app as login (no separate credentials needed); profile card with avatar, bio, location, follower/repo counts; pin up to 6 repos; manual sync (5/hr); daily cron at 04:00 UTC; access tokens **encrypted at rest** (AES-256-GCM)
- **Project showcase** — create and curate projects (title, description, tags, demo/repo URLs, **cover image URL**, featured flag); optional link to a cached GitHub repo for live star counts; drag-reorder via up/down controls; image preview on cards
- **LinkedIn strength** — URL auto-normalises on input (bare username, missing https, /in/ prefix); server-side reachability check on save; self-assessed 8-item checklist auto-saves per-toggle (no manual save needed)
- **Public portfolio page** — shareable `/p/{username}` page; SSR with full OpenGraph metadata; sections: hero (avatar, bio, links, GitHub stats), featured projects, pinned repos, skills by category, education, certifications; contact email shown only when explicitly opted in; no job application data ever exposed

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
- **Source tracking** — 11 sources (LinkedIn, Indeed, Referral, Company Website…); each source badge uses the platform's official brand colour (`SOURCE_COLORS` in `config/constants.ts`) with dark-mode variants — LinkedIn `#0A66C2`, Indeed `#003A9B`, Glassdoor `#0CAA41`, Handshake `#E8552A`, Wellfound `#111111`, Dice `#EB1C26`, Referral violet, Recruiter Outreach amber, Job Fair cyan, Company Website slate
- **Application completeness score** — 10-field ring on list cards (visual only); full interactive checklist on detail page (auto-refreshes on tab focus)
- **ATS score badge** — persisted to DB after each scan; shown in bottom meta row
- **Created / Updated timestamps** — each application card shows `Created May 12 at 3:45 PM` and `· Updated May 13 at 9:20 AM` (only when modified after creation) using device-local timezone
- **Status Journey** — visual stepper on application detail showing days spent at each status stage; horizontal on desktop, vertical on mobile; derived from activity logs (zero extra DB queries)
- Filter by status, location, date range; sort by date/company/position
- **Cursor-paginated list view** — keyset pagination on `(applied_date DESC, id DESC)`; "Load more" appends pages client-side without losing existing items; kanban view still loads all rows for drag-and-drop
- **Full-text search** — command palette (`⌘K`) searches applications via GIN-indexed `search_vector` column with `websearch_to_tsquery`; falls back to `ilike` on company/position; results appear inline with keyboard navigation
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
- **PDF annotation** — full PDF.js canvas renderer; click to place colour-coded sticky notes at exact coordinates; drag to reposition; auto-save on blur; 5 colour presets; per-document server-side storage with RLS (`document_annotations` table, migration 30)
- **Cover letter variable preview** — live substitution of `{{company}}`, `{{position}}` and any `{{token}}` found in text/markdown cover letters; auto-fills application context; one-click copy to clipboard
- **Resume autofill in application form** — "Fill from resume" picker loads library resumes; calls `parse-resume` API; suggests position from experience; appends skills summary to notes
- **Google Drive import** — Google Picker OAuth (`drive.file` scope); server-side file download proxy (`/api/documents/import-drive`) with verifyOrigin, rate limit, MIME check, magic-byte validation, AV scan; shows setup banner when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is absent
- **Dropbox import** — Dropbox Chooser SDK (dynamic script); direct-link piped through existing `import-url` SSRF-protected route; shows setup notice when `NEXT_PUBLIC_DROPBOX_APP_KEY` is absent
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
- **Offer Decision Helper** — select up to 3 offers, rate 5 criteria (Total Comp, Career Growth, Location, Culture, Benefits), adjust global importance weights; live weighted score + winner callout

### NESTAi — AI Job Search Assistant
- ChatGPT-style interface; full access to applications, interviews, reminders, contacts, salary, documents
- **Streaming responses** with stop button; markdown rendering; suggested follow-ups; animated "Thinking…" indicator while awaiting first token
- **Work authorization aware** — user's visa status injected into system prompt
- **File attachments** — PDF, DOCX, TXT, MD, images up to 5 MB; binary always stored to Supabase Storage via `parse-file`; binary-only preview modal: PDF → CSP-safe blob URL iframe (full native PDF viewer with controls), Image → `<img>`, TXT/MD → raw file bytes, DOCX → "Open in browser"; preview independent from AI text extraction; 10-min signed URLs; preview survives page navigation (storagePath persisted in `chat_messages.metadata`)
- **Edit messages in-place** — edited message stays at same position; AI response replaces the one after it; file attachment preserved through edit
- **Interview Prep** — "Prep" button opens a modal; pick an active application → 5 tailored STAR behavioral questions generated from the stored JD; provide draft answers for specific AI feedback
- **Email Draft Assistant** — "Draft" button opens a modal; pick an email category (Follow Up, Thank You, Cold Outreach, Networking, Referral Request, Offer Negotiation, Withdrawal) and an optional contact; Groq drafts a professional email into the chat input for review and editing
- **Model fallback** — primary `llama-3.3-70b-versatile`; auto-falls back to `llama-3.1-8b-instant` on Groq 429/5xx; amber "reduced capacity" banner shown to user
- Pin chats, edit messages, rename/delete sessions with confirm dialog
- Rate limits: 5 req/min free · 30 req/min Pro; live counter with countdown and progress bar
- Smart context trimming (4-step, 124,500-token budget); 100-message history
- **NESTAi handoff from ATS** — sessionStorage pre-fills input after a scan

### Technical Interview Prep Hub (`/prep`)
- **Dashboard** — 4 SVG progress rings (DSA solved, system design comfortable, behavioral drafted, mocks completed) + daily streak counter with longest-streak badge
- **Coding tracker** — LeetCode-style problem log: title, URL, difficulty, topic, status (Todo/Attempted/Solved/Review), company tags, solve time, notes; filter by topic/difficulty; spaced-repetition Review queue surfaces problems not visited in 7+ days
- **System design checklist** — 15 topics (Load Balancer, CDN, CAP Theorem, Rate Limiting, Message Queues, Caching, Consistent Hashing, SQL vs NoSQL…); click to cycle Not Started → Reading → Comfortable; links to system-design-primer; persisted to DB
- **STAR behavioral bank** — 15 pre-seeded questions across 8 competencies; expandable Situation/Task/Action/Result form per question; filter by competency; word count shown
- **Take-home assessment tracker** — platform, deadline, time limit, tech stack, status (Pending/In Progress/Submitted/Passed/Failed), score; link to a job application; overdue detection
- **Mock interview scheduler** — schedule sessions by type (DSA/Behavioral/System Design/Mixed); log post-session score (1–5 stars), feedback, topics to revisit
- **Interview question log** — log questions asked in real interviews, grouped by interview; category + difficulty tags; builds a personal question bank over time
- **Daily prep streak** — any prep activity increments the streak; resets after a gap day; longest streak preserved

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
| Language | TypeScript 6.0.2 |
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
| PDF Annotation | PDF.js (`pdfjs-dist` 5.x, CDN worker) |
| Cloud Import | Google Picker API + Dropbox Chooser SDK |
| Testing | Vitest (1032 tests, 73 files) |

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
│   │   ├── prep/                 # Interview Prep Hub (problems, system design, STAR, mocks)
│   │   ├── notifications/
│   │   └── profile/
│   ├── (public)/                 # Public pages (shared LandingHeader + LandingFooter)
│   │   ├── page.tsx              # Landing page with JSON-LD structured data
│   │   ├── pricing/              # Pricing page with JSON-LD Product schema
│   │   ├── privacy/
│   │   ├── terms/
│   │   ├── contact/
│   │   └── cookies/
│   ├── p/[username]/             # Public portfolio page — SSR, no auth required
│   ├── api/
│   │   ├── auth/                 # send-otp, verify-otp, reset-password
│   │   ├── profile/              # update-name, change-password, update-about-me,
│   │   │                         # update-nestai-context, update-notifications,
│   │   │                         # update-work-authorization, update-portfolio-visibility,
│   │   │                         # delete-account, reactivate-account, verify-change-otp,
│   │   │                         # export-data (GDPR), complete-onboarding
│   │   ├── portfolio/
│   │   │   ├── github/           # connect (OAuth redirect), callback, disconnect,
│   │   │   │                     # connection (GET), repos (GET/PATCH pin), sync (POST)
│   │   │   ├── projects/         # list/create + [id] update/delete
│   │   │   ├── linkedin/         # GET/POST — URL + strength checklist
│   │   │   └── username/         # GET availability, POST claim
│   │   ├── cron/
│   │   │   ├── process-deletions/    # Daily 09:00 UTC
│   │   │   ├── overdue-reminders/    # Daily 09:00 UTC
│   │   │   ├── weekly-digest/        # Mondays 08:00 UTC
│   │   │   ├── follow-up-reminders/  # Daily 09:00 UTC — Day 7/14/21 auto-reminders
│   │   │   ├── re-engagement/        # Daily 10:00 UTC — 14-day inactivity emails
│   │   │   └── github-sync/          # Daily 04:00 UTC — refresh all GitHub connections
│   │   ├── documents/            # list, upload, [id], [id]/annotations, [id]/annotations/[annId],
│   │   │                         # ats-scan, import-url, import-drive, share, shared, refresh-url, diff, parse-resume
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
│   ├── documents/                # DocumentManager, AnnotationDialog, DocPreviewDialog, DiffDialog, GoogleDriveImportButton
│   ├── layout/                   # Navbar, BottomTabBar, NotificationBell, ThemeToggle
│   ├── prep/                     # PrepHub, CodingProblemsTracker, SystemDesignChecklist,
│   │                             # BehavioralBank, AssessmentsTracker, MockInterviewScheduler,
│   │                             # InterviewQuestionLog
│   ├── portfolio/                # GitHubSection, ProjectsSection, LinkedInSection,
│   │                             # PortfolioSettings
│   └── profile/                  # ProfileClient, DeletionBanner, DeveloperIdentity
├── lib/
│   ├── api/
│   ├── auth/                     # plan.ts — fail-closed plan enforcement
│   ├── email/                    # Nodemailer — all email types
│   ├── notifications/
│   ├── security/                 # OTP, rate-limit (Redis), CSRF, virus-scan (Cloudmersive), sanitize.ts
│   ├── utils/
│   │   ├── completeness.ts       # Application completeness scoring (10 fields, 0–10)
│   │   ├── date.ts               # Shared date/time formatting — Intl locale + IANA timezone from device; formatDate, formatDateTime, formatRelative, formatDuration helpers
│   │   ├── document-parser.ts    # PDF/DOCX/TXT extraction
│   │   ├── fetch-retry.ts
│   │   ├── storage.ts
│   │   └── template-helpers.ts  # substituteVariables() + extractVariableKeys() — shared by cover-letter preview and email templates
│   ├── env.ts                    # Startup env validation
│   └── validations/              # Zod schemas; secureUrlField shared transformer (null-byte strip, scheme blocklist, new URL() check)
├── services/
├── config/                       # Constants (APPLICATION_STATUSES, APPLICATION_SOURCES, WORK_AUTHORIZATION_OPTIONS)
├── types/
├── public/
│   ├── llms.txt                  # LLM-readable site description (GEO)
│   └── robots.txt
├── vercel.json                   # 5 cron job schedules
└── proxy.ts                      # Route protection + security headers

supabase/
└── migrations/                   # SQL migration files (run in order, 000 → 031)
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

# Google Drive import (optional — set both or neither)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_GOOGLE_API_KEY=...

# Dropbox import (optional)
NEXT_PUBLIC_DROPBOX_APP_KEY=...

# GitHub OAuth — Developer Portfolio
# The portfolio GitHub connect uses the same OAuth app already configured in
# Supabase for login (Auth → Providers → GitHub). No separate app needed.
# Add the callback URL to Supabase → Auth → URL Configuration → Redirect URLs:
#   https://yourdomain.com/api/portfolio/github/callback
# GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are NOT required in the app env.

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
| 23 | `...023_fulltext_search.sql` | `search_vector` tsvector + GIN index + trigger on `job_applications` |
| 24 | `...024_developer_identity.sql` | `skills`, `certifications`, `education` tables with RLS + CHECK constraints |
| 25 | `...025_sponsorship_and_work_auth.sql` | `requires_sponsorship` on applications, `opt_start_date` for OPT tracker |
| 26 | `...026_salary_details_tc.sql` | TC calculator fields: `equity_details`, `retirement_match_*`, `col_city` |
| 27 | `...027_prep_hub.sql` | `coding_problems`, `assessments`, `behavioral_answers`, `mock_interviews`, `interview_questions`, `prep_streaks` — all with RLS |
| 28 | `...028_chat_attachments_storage.sql` | Expand documents bucket MIME types (webp, gif, heic, heif, avif, bmp, tiff, octet-stream) |
| 29 | `...029_allow_chat_attachments_path.sql` | Extend `user_owns_application()` to allow `'chat-attachments'` as trusted second-segment in storage paths |
| 30 | `...030_document_annotations.sql` | `document_annotations` table — page-relative x/y/width coordinates, colour, content; RLS owner-only; indexes on `document_id` + `user_id` |
| 31 | `...031_portfolio.sql` | `usernames` (slug → user_id lookup), `github_connections` (OAuth token + profile stats), `github_repos` (cached repos, is_pinned), `projects` (showcase with optional repo link), `application_projects` (junction); FORCE RLS + `WITH CHECK` on all tables; `set_updated_at` triggers |

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
npm test              # Vitest (1032 tests, 73 files)
npm run test:coverage # Coverage report
```

---

## Testing

All tests run with **Vitest** — no browser or external service required. All dependencies mocked.

| Suite | Location | Coverage |
|---|---|---|
| Unit | `tests/unit/` | lib utilities (incl. **token encryption roundtrip/legacy/tamper**, **`formatCompactDateTime`**), all API route handlers (incl. parse-jd SSRF, attachment-url, search, skills/certifications/education, all 5 prep route groups, **LinkedIn verify** — all fetch status branches), analytics metrics, proxy + CSP nonce |
| Mobile/UX | `tests/unit/mobile/` | Responsive layout, aria labels, CSS tokens |
| E2E flows | `tests/flows/` | Login, signup, forgot-password, change-password, delete+reactivate, NESTAi chat+upload+model-fallback, Stripe billing, developer identity full CRUD, **portfolio** (GitHub connection/repos/disconnect/sync, projects CRUD + **image_url validation**, LinkedIn, username claim/availability/**DELETE**/**30-day cooldown**, visibility, cron auth, **decryptToken path**) |

---

## Security

| Feature | Detail |
|---|---|
| OTP | SHA-256 hashed, timing-safe comparison, 5 purposes |
| Rate limiting | Redis-backed (Upstash); dual-layer on send-otp (IP + per-email) |
| Virus scanning | Cloudmersive multi-engine AV on all uploads + URL imports (fail-open) |
| Magic bytes | Server-side content validation prevents extension spoofing |
| CSRF | `SameSite=Lax` + `verifyOrigin()` on **all** session-authenticated mutation routes — profile, documents (upload, share, ats-scan, import-url, import-drive, [id] DELETE, restore, purge-versions, annotations), NESTAi (chat, sessions CRUD, messages), Stripe checkout, application status PATCH, onboarding, parse-jd, parse-file, all 11 prep API endpoints |
| IDOR | `interview_id` ownership validated against `interviews` table before inserting `interview_questions`; `application_id` ownership validated before linking an assessment |
| SSRF | `assertSafeUrl()` on parse-jd: DNS pre-resolution blocks loopback, RFC-1918, link-local (AWS/GCP metadata), CGNAT; post-redirect check prevents open-redirect chains |
| Path traversal | `session_id` validated as UUID before use in Storage path; `..` segments rejected in attachment-url; Storage path `{uid}/chat-attachments/…` — first segment is user ID, enforced by RLS |
| Cron auth | `Authorization: Bearer <CRON_SECRET>` — fail-closed |
| RLS | All tables enforce row-level security via `auth.uid()` |
| Plan enforcement | Reads `subscriptions` via service-role — fail-closed, never grants Pro on error |
| Document serving | `Content-Disposition: attachment` forced — prevents stored XSS |
| Startup validation | `instrumentation.ts` throws on missing required env vars |
| Headers | HSTS, nonce-based CSP (no `unsafe-eval`; `strict-dynamic`), X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| Input validation | UUID format check on all profile DELETE routes (returns 400 not 500); DELETE returns 404 when no row is found (prevents silent no-op) |
| GitHub OAuth | Uses Supabase-configured OAuth (same app as login); client-side `signInWithOAuth` with PKCE; `session.provider_token` extracted in server callback; `redirectTo` validated against Supabase allowed URLs |
| GitHub token at rest | AES-256-GCM encryption in `lib/security/tokens.ts` keyed from `CSRF_SECRET`; legacy plaintext tokens (`gho_`/`ghp_`) handled transparently until users reconnect |
| OAuth redirect hardening | `appUrl` in callback/connect routes pinned to `NEXT_PUBLIC_APP_URL`; no `x-forwarded-host` derivation for redirect targets (prevents open-redirect on non-Vercel deployments) |
| Email disclosure | `user.email` never exposed on public portfolio by default; `show_email` must be explicitly opted in via profile settings (stored in `user_metadata`, defaults `false`) |

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
| `/api/cron/github-sync` | Daily 04:00 UTC | Refresh GitHub profile + repos for all connected users |

**`CRON_SECRET` must be set** — all cron endpoints return 401 without it.

---

## Contributing / Issues

Found a bug? [Open an issue on GitHub](https://github.com/Git-Nish14/Jobnest/issues).

---

## License

Private — All rights reserved

---

Built by [Nish Patel](https://nishpatel.dev)
