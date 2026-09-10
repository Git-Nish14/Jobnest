# Jobnest

A full-stack job search management platform. Track applications, manage documents, and prepare for interviews. All in one place.

**Live:** [jobnest.nishpatel.dev](https://jobnest.nishpatel.dev) · **By [Nish Patel](https://nishpatel.dev)**

---

## Features

### Authentication
- Email and password with 6-digit OTP verification (Nodemailer)
- Google, GitHub, and LinkedIn OAuth with provider-agnostic callback
- Age verification and Terms acceptance required at signup for all auth methods
- Persistent sessions (30-day "stay signed in") with `__Host-` cookie prefix in production
- Logout scope dialog: sign out of this device only, or all devices
- Cross-tab logout sync via `onAuthStateChange`
- Protected routes via `proxy.ts` middleware with Supabase SSR session refresh

### Dashboard
- Application stats: total, this week, this month, active pipeline, offers, upcoming interviews
- Mobile privacy mode: stat values blurred by default, revealed with an Eye toggle
- Application Velocity chart with daily, weekly, and monthly granularity
- Extended analytics (available at 3+ applications):
  - Monthly Breakdown (Applied, Rejected, Offers)
  - Weekday Activity with peak-day callout using device-local time
  - Stage Funnel with per-transition conversion rates vs. industry benchmarks
  - Source Effectiveness and Response Rate by Tier
- Search Intelligence: 6 metric cards (response time, interview-to-offer rate, ghosting rate, live opportunities, weekly momentum, best source)
- Weekly Cadence: goal vs. actual with a 12-week velocity chart
- Weekly Report PDF generated server-side via `@react-pdf/renderer`

### Applications
- Full CRUD with statuses: Applied, Phone Screen, Interview, Offer, Rejected, Withdrawn, Ghosted
- Import from job posting URL or pasted text with Groq-powered field extraction (SSRF-protected)
- AI JSON autofill: paste structured output from any external AI to fill all 13 fields
- ATS score badge persisted to the database after each scan
- Application completeness score (10-field ring on cards)
- Status Journey: visual stepper showing time spent at each stage, derived from activity logs
- Duplicate warning on the new application form (debounced, non-blocking)
- Two-step delete from both the card dropdown and the detail page, with Storage cleanup
- Document auto-purge queue on rejection with a 30-day countdown and in-app notifications
- Cursor-paginated list view with full-text search via GIN-indexed `search_vector` (includes `notes` and `job_description`)
- Universal filter dropdown with status, source, tier, and sort
- CSV bulk import wizard (up to 500 rows, Zod-validated per row)
- Export to CSV, JSON, or a 4-page PDF report
- Company tier tagging (FAANG, Tier 1, Tier 2, Tier 3, Startup)
- Glassdoor rating field with a direct search link

### Document Library
- Personal master library separate from per-application documents
- 1 GB quota with a colour-coded progress bar
- Inline preview for PDF, images, DOCX, and plain text
- PDF annotation with PDF.js: click to place sticky notes, drag to reposition
- Cover letter variable preview with live `{{company}}`, `{{position}}` substitution
- Resume autofill in the application form via `parse-resume`
- Google Drive and Dropbox import with SSRF protection and virus scanning
- Version history with restore and diff comparison
- Shareable links with 1-day, 7-day, and 30-day expiry and view count analytics
- ATS Scan shortcut on each compatible document card

### Interviews
- Schedule per application with type, round, duration, meeting URL, and interviewer names
- Pre-interview and post-interview notes
- Status: Scheduled, Completed, Cancelled, Rescheduled

### Reminders
- Manual reminders and auto-generated follow-up cadence (day 7, 14, 21)
- Types: Follow Up, Interview, Deadline
- Mobile swipe-to-complete: direction-locked right swipe with a green confirmation backdrop
- Bulk actions: Mark all complete, Clear completed, Delete all
- Real-time updates via Supabase Realtime `postgres_changes` subscription
- Push notifications for overdue reminders (Web Push API, VAPID-signed)
- Opt-in `PushNotificationSubscriber` button on the reminders page

### Contacts and Networking
- Contacts with company, school, email, phone, LinkedIn URL, and notes
- Per-contact outreach pipeline (Not Contacted through Referral Requested)
- Networking page with three tabs:
  - **Outreach**: Kanban-style pipeline with alumni detection from Education profile
  - **Referrals**: track referrals per application with status and analytics
  - **Coffee Chats**: schedule informational interviews with automatic reminder creation

### Email Templates
- Reusable templates by category with `{{variable}}` placeholder substitution

### Salary Tracker
- Base salary, bonus, signing bonus, equity, and benefits per application
- Salary Comparison table across all applications with status context
- Multi-currency support with state income tax take-home estimate
- Salary Benchmarking against P25/P50/P75 market data by company tier
- Offer Decision Helper: compare up to 3 offers across 5 weighted criteria

### NESTAi (AI Assistant)
- ChatGPT-style streaming interface with full access to application data
- Hybrid semantic RAG for Pro users: BM25 + cosine similarity fused via Reciprocal Rank Fusion
- Nightly reindex cron at 02:00 UTC for Pro users
- Conversation memory: extracts up to 20 preference bullets per session, persisted and injected into future prompts
- Chat-to-PDF export
- File attachments: PDF, DOCX, TXT, Markdown, and images up to 5 MB
- Interview Prep: 5 tailored STAR questions from a selected job description
- Email Draft Assistant: 7 email categories with Groq drafting
- NESTpro Audit: 30-checkpoint resume rubric with AI qualitative scoring
- Model fallback: `llama-3.3-70b-versatile` with automatic fallback to `llama-3.1-8b-instant`
- Rate limits: 5 req/min (Free), 30 req/min (Pro)
- Atomic daily token cap via Redis INCRBY reservation

### ATS Scanner
- Upload resume and paste a job description for a 0-100 match score
- 5 configurable AI providers: Groq, OpenAI, Anthropic, Google Gemini, Perplexity
- Server-side keyword overlap pre-computation anchors the AI score to real data
- NESTpro Audit tab with 30+ checkpoints and expandable category bars

### Technical Interview Prep
- Dashboard with progress rings for DSA, system design, behavioral, and mock interviews
- Coding problem tracker with spaced-repetition review queue
- System design checklist with 15 topics
- STAR behavioral question bank with per-competency filtering
- Take-home assessment tracker
- Mock interview scheduler with post-session scoring

### Notifications
- Real-time badge via Supabase Realtime on `reminders`, `interviews`, and `notifications` tables
- Badge total: overdue reminders + upcoming interviews (24-hour window) + unread notifications
- Full notifications page with All, Unread, and Read tabs, bulk mark-read, and cursor pagination
- Daily cron creates in-app notifications for overdue reminders and upcoming interviews

### Developer Portfolio (`/p/{username}`)
- GitHub OAuth integration with encrypted access token storage (AES-256-GCM)
- Pin up to 6 repositories with a daily sync cron at 04:00 UTC
- Project showcase with cover images, tags, demo URLs, and drag reorder
- LinkedIn profile strength checklist with auto-detection of profile photo via OIDC
- Public shareable page with full OpenGraph metadata

### Billing
- Stripe checkout, webhooks, billing portal, and dunning email
- 30-day trial with annual billing toggle and mid-cycle proration
- Student discount via server-side `.edu` allowlist (16 academic TLDs)
- Plan enforcement reads `subscriptions` via service role and fails closed on DB error

### Design System and PWA
- Responsive across all screen types: phones, tablets, foldables (Galaxy Fold, Pixel Fold, Surface Duo), landscape, and desktop PWA
- Foldable device support via `@media (horizontal-viewport-segments: 2)` and `@media (vertical-viewport-segments: 2)`; bottom tab bar is hidden when dual-screen navigation is sufficient
- PWA `themeColor` is a light/dark array; `ThemeToggle` syncs `<meta name="theme-color">` at runtime so the iOS status bar matches the active UI theme
- `color-scheme: light` / `dark` on `:root` and `.dark`; browser-native scrollbars, inputs, and selects render in the correct palette
- `manifest.json` orientation is `any`; `display_override` adds `window-controls-overlay` for desktop PWA title bar
- Navbar mobile slide panel: `slide-in-right` animation (0.28 s), frosted-glass backdrop with `blur(4px)`, panel width expanded to `max-w-sm`
- Desktop nav dropdown flyout: `flyout-in` animation (Y and scale only; `translateX` omitted to avoid Tailwind v4 additive-transform conflict)
- Auth card padding is responsive (1.5 rem on narrow viewports, 2 rem at 400 px and above)
- All auth UI text meets WCAG minimum sizes; footer links have a 44 px touch target
- Landing header has `backdrop-filter: blur(20px)` for a professional glass effect on scroll
- `sm` and `lg` button sizes inherit `rounded-full` for consistent pill shape across all sizes

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 6 |
| Database | Supabase (PostgreSQL with RLS) |
| Auth | Custom OTP via Nodemailer + Supabase Auth |
| AI (NESTAi) | Groq `llama-3.3-70b-versatile` + OpenAI `text-embedding-3-small` |
| AI (ATS) | Groq, OpenAI, Anthropic, Google Gemini, Perplexity |
| Email | Nodemailer (SMTP) |
| Billing | Stripe |
| Virus Scanning | Cloudmersive (fail-open) |
| Rate Limiting | Upstash Redis (falls back to in-memory) |
| Push Notifications | Web Push API with VAPID (`web-push`) |
| Styling | Tailwind CSS 4 with dark mode |
| UI | Radix UI primitives |
| Forms | React Hook Form + Zod |
| PDF | `@react-pdf/renderer` (generation) + `pdfjs-dist` (annotation) |
| Testing | Vitest (1870 tests, 112 files) + Playwright E2E (19 spec files) |
| Error Monitoring | Sentry |

---

## Project Structure

```
web/
├── app/
│   ├── (auth)/                   # Login, signup, forgot-password
│   ├── (dashboard)/              # Protected dashboard pages
│   │   ├── applications/
│   │   ├── ats/
│   │   ├── documents/
│   │   ├── interviews/
│   │   ├── reminders/
│   │   ├── contacts/
│   │   ├── networking/
│   │   ├── templates/
│   │   ├── salary/
│   │   ├── nestai/
│   │   ├── prep/
│   │   ├── notifications/
│   │   └── profile/
│   ├── (public)/                 # Landing, pricing, privacy, terms
│   ├── p/[username]/             # Public portfolio page
│   └── api/
│       ├── auth/
│       ├── applications/
│       ├── documents/
│       ├── nesta-ai/
│       ├── push/                 # Web Push subscribe and unsubscribe
│       ├── notifications/
│       ├── profile/
│       ├── portfolio/
│       ├── salary/
│       ├── stripe/
│       └── cron/
│           ├── process-deletions/
│           ├── overdue-reminders/
│           ├── weekly-digest/
│           ├── follow-up-reminders/
│           ├── re-engagement/
│           ├── github-sync/
│           ├── purge-rejected-documents/
│           ├── milestone-celebrations/
│           ├── weekly-motivation/
│           └── nestai-reindex/
├── components/
├── lib/
│   ├── email/
│   ├── features/                 # ai-usage.ts (token cap, Redis reservation)
│   ├── push/                     # send.ts (sendUserPushNotifications)
│   ├── security/                 # OTP, CSRF, rate-limit, virus-scan, sanitize
│   └── utils/
├── services/
├── tests/
│   ├── unit/
│   ├── flows/
│   └── e2e/
├── public/
│   ├── sw.js                     # Service worker (caching + push notifications)
│   └── manifest.json
└── proxy.ts                      # Route protection and security headers

supabase/
└── migrations/                   # 051 migrations (run in order)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project
- SMTP server
- Groq API key (required for NESTAi)
- Stripe account (optional)
- Upstash Redis (optional, falls back to in-memory)
- Cloudmersive API key (optional, skipped when absent)

### Environment Variables

Copy `web/.env.local.example` to `web/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_APP_URL=

# Security (generate with: openssl rand -hex 32)
CSRF_SECRET=
CRON_SECRET=

# SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
CONTACT_EMAIL=

# AI
GROQ_API_KEY=
OPENAI_API_KEY=        # optional
ANTHROPIC_API_KEY=     # optional
GEMINI_API_KEY=        # optional
PERPLEXITY_API_KEY=    # optional

# Push notifications (generate with: npx web-push generate-vapid-keys)
VAPID_EMAIL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# Stripe (optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_PRO_ANNUAL_PRICE_ID=

# Redis (optional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Virus scanning (optional)
CLOUDMERSIVE_API_KEY=
```

### Database Setup

Run migrations in order from `supabase/migrations/` via the Supabase SQL editor. Key milestones:

| Range | Purpose |
|---|---|
| 000-010 | Core schema, auth, storage, chat, billing |
| 011-022 | RLS hardening, documents, activity logs, notifications, ATS fields |
| 023 | Full-text search (`search_vector` GIN index) |
| 024-030 | Developer identity, salary, prep hub, PDF annotations |
| 031-046 | Portfolio, networking, AI usage, feature flags, referrals |
| 047-048 | NESTAi RAG (pgvector, hybrid BM25+cosine search, conversation memory) |
| 049 | Extend `search_vector` to include `job_description` |
| 050 | `push_subscriptions` table for Web Push |

### Installation

```bash
cd web
npm install
npm run dev
```

---

## Scripts

```bash
npm run dev            # Development server (Turbopack)
npm run build          # Production build
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm test               # Vitest unit and flow tests
npm run test:coverage  # Coverage report with thresholds
npm run test:e2e       # Playwright E2E (requires staging credentials)
npm run analyze        # Webpack bundle treemap
```

---

## Testing

Vitest unit and flow tests run without any external services. Playwright E2E tests target a live Supabase backend and are skipped automatically when credentials are absent.

| Suite | Location | Coverage |
|---|---|---|
| Unit | `tests/unit/` | API route handlers, lib utilities, security helpers, Zod schemas |
| Flow | `tests/flows/` | Auth flows, NESTAi chat, Stripe billing, portfolio |
| E2E | `tests/e2e/` | Public pages, application CRUD, search, mobile UX, ATS, documents |

Current: **1870 tests across 112 files**, all passing.

Coverage thresholds: 47% statements, 40% branches, 42% functions, 50% lines.

---

## Security

| Area | Implementation |
|---|---|
| OTP | SHA-256 hashed with timing-safe comparison |
| Rate limiting | Redis-backed via Upstash, with in-memory fallback |
| CSRF | `SameSite=Lax` cookies with `verifyOrigin()` on all mutation routes |
| Atomic token cap | Redis INCRBY pipeline reserves tokens before streaming, eliminating the TOCTOU window |
| Push subscription cap | Maximum 10 subscriptions per user with rate limiting to prevent cron amplification |
| Content security | Magic-byte validation on all uploads, virus scanning via Cloudmersive |
| SSRF protection | DNS pre-resolution and post-redirect IP check on all URL fetch routes |
| RLS | Row-level security enforced on all tables via `auth.uid()` |
| IDOR | Ownership verified server-side before every mutation |
| Path traversal | UUIDs validated, `..` segments rejected, Storage paths scoped to `{uid}/` |
| Headers | HSTS, nonce-based CSP without `unsafe-eval`, X-Frame-Options, Referrer-Policy |
| GitHub tokens | AES-256-GCM encrypted at rest |
| Cron auth | `Authorization: Bearer <CRON_SECRET>` required, fail-closed |

---

## Deployment

### Vercel

1. Import the repository and set the root directory to `web/`
2. Add all environment variables
3. Deploy

`vercel.json` configures cron jobs automatically:

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/process-deletions` | Daily 09:00 UTC | Grace-period account deletion |
| `/api/cron/overdue-reminders` | Daily 09:00 UTC | In-app notifications, emails, and push notifications |
| `/api/cron/weekly-digest` | Mondays 08:00 UTC | Weekly digest email |
| `/api/cron/follow-up-reminders` | Daily 09:00 UTC | Day 7, 14, 21 auto-reminders |
| `/api/cron/re-engagement` | Daily 10:00 UTC | 14-day inactivity email |
| `/api/cron/github-sync` | Daily 04:00 UTC | Refresh GitHub profiles and repos |
| `/api/cron/purge-rejected-documents` | Daily 03:00 UTC | Delete Storage files after 30-day rejection window |
| `/api/cron/nestai-reindex` | Daily 02:00 UTC | Pre-warm NESTAi embeddings for Pro users |

`CRON_SECRET` must be set. All cron endpoints return 401 without it.

---

## License

Private. All rights reserved.

Built by [Nish Patel](https://nishpatel.dev)
