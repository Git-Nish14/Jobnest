# Jobnest

> A full-stack job search management platform — track applications, manage documents, prepare for interviews, and let AI work the grind with you.

**Live demo:** [jobnest.nishpatel.dev](https://jobnest.nishpatel.dev) &nbsp;·&nbsp; **Built by [Nish Patel](https://nishpatel.dev)**

---

## What is Jobnest?

Job searching is exhausting. Between tracking dozens of applications across spreadsheets, remembering who you followed up with, and prepping for interviews on top of a full schedule — things fall through the cracks.

Jobnest is a single workspace that handles all of it. Log applications, attach your resume and cover letter, get AI-powered feedback, stay on top of reminders, and actually understand your search with real analytics — without switching between five different tools.

It's built in the open so other developers can learn from it, contribute to it, or fork it for their own needs.

---

## Features

### Applications
Track every application from first click to offer letter. Log the company, role, salary range, job description, and source. The status pipeline covers the full journey: Applied → Phone Screen → Interview → Offer → Rejected / Withdrawn / Ghosted.

- Import directly from a job posting URL or pasted text — Groq extracts all fields automatically
- Save jobs from ChatGPT through an MCP plugin with OAuth account linking ([setup guide](docs/CHATGPT_PLUGIN_SETUP.md))
- ATS compatibility score persisted per application after each scan
- Completeness score so you know what's missing before you submit
- Status Journey view showing time spent at each stage
- Full-text search across notes, job descriptions, and company names
- Filter by status, source, company tier, and sort order
- CSV bulk import (up to 500 rows) and export to CSV, JSON, or PDF report
- Two-step delete with automatic document cleanup

### Document Library
A personal document hub separate from per-application files — one place to keep every version of your resume and cover letters.

- Inline preview for PDFs, images, and Word documents (DOCX rendered as HTML in the browser, no plugins needed)
- PDF annotation: click to place sticky notes, drag to reposition
- Live cover letter preview with `{{company}}` and `{{position}}` variable substitution
- Resume autofill — parse a resume directly into an application form
- Import from Google Drive or Dropbox
- Full version history with restore and side-by-side diff comparison
- Shareable links with 1-day, 7-day, or 30-day expiry and view-count analytics
- 1 GB storage quota per account with a visual usage indicator

### NESTAi — AI Assistant
A streaming AI chat with full context of your job search data. Powered by **GPT-5.6 Luna** (OpenAI) for high-reasoning answers without the wait.

- Attach resumes, cover letters, and job descriptions — NESTAi reads them directly
- Send screenshots or images — Luna's vision model understands them without OCR
- Hybrid semantic search (BM25 + cosine similarity, Reciprocal Rank Fusion) over your documents, available on Pro
- Conversation memory: key preferences and context are extracted and carried into future sessions
- Interview Prep: generates 5 STAR-method questions tailored to a specific job description
- Email Draft Assistant: drafts follow-ups, thank-you notes, and outreach across 7 categories
- NESTpro Resume Audit: a 30-checkpoint rubric with AI-scored qualitative feedback
- Export any chat session to PDF
- Daily token caps to keep usage fair: 2M tokens (Free), 10M tokens (Pro)

### ATS Scanner
Upload a resume and paste a job description to get a 0–100 match score. Keyword overlap is calculated server-side to ground the AI score in real data.

- Supports five AI providers: Groq, OpenAI, Anthropic, Google Gemini, and Perplexity
- NESTpro Audit tab with 30+ actionable checkpoints and expandable category breakdowns

### Interview Preparation
A structured hub for technical and behavioral interview practice.

- Progress rings for DSA, system design, behavioral, and mock interview readiness
- Coding problem tracker with a spaced-repetition review queue
- System design checklist covering 15 core topics
- STAR behavioral question bank with per-competency filtering
- Take-home assessment tracker and mock interview scheduler with post-session scoring

### Reminders and Notifications
Never let a follow-up slip. Reminders are created manually or auto-generated on a day 7, 14, and 21 cadence after you apply.

- Real-time notification badge: increments instantly when new reminders, interviews, or alerts arrive — no page reload needed
- Push notifications for overdue reminders via the Web Push API (opt-in, works without the tab open)
- Mobile swipe-to-complete gesture on the reminders list
- Bulk actions: mark all complete, clear completed, delete all
- Notification inbox with All, Unread, and Read tabs, quick "View" links to the relevant page, and bulk mark-read

### Salary and Offers
Make sense of compensation before you sign anything.

- Log base salary, bonus, signing bonus, equity, and benefits per application
- Side-by-side comparison table across all applications with current status
- Multi-currency support with state income tax take-home estimate
- Benchmarking against P25 / P50 / P75 market rates by company tier
- Offer Decision Helper: rank up to 3 offers across 5 weighted criteria

### Contacts and Networking
Track the people behind the opportunities.

- Contact profiles with company, school, email, phone, LinkedIn, and notes
- Outreach pipeline: Kanban board from Not Contacted to Referral Requested, with alumni detection
- Referral tracker per application with status and analytics
- Coffee chat scheduler with automatic reminder creation

### Analytics
Understand your search at a glance, not just feel it.

- Application Velocity chart (daily, weekly, monthly) with a weekly goal tracker
- Monthly Breakdown of Applied, Rejected, and Offers
- Stage Funnel with per-transition conversion rates versus industry benchmarks
- Source Effectiveness: which job boards and channels actually convert
- Six Search Intelligence metrics: response time, interview-to-offer rate, ghosting rate, live opportunities, momentum, and best source
- Weekly Report PDF generated on demand

### Developer Portfolio (`/p/{username}`)
A public-facing page to showcase who you are beyond the resume.

- GitHub OAuth integration with pinned repositories (daily sync)
- Project showcase with cover images, tags, demo links, and drag-and-drop reorder
- LinkedIn profile strength checklist
- Public shareable URL with full OpenGraph metadata

### Billing
- Stripe checkout, webhooks, billing portal, and dunning email
- 30-day free trial with annual billing toggle and mid-cycle proration
- Student discount verified server-side against a `.edu` domain allowlist

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 6 |
| Database | Supabase (PostgreSQL + pgvector, row-level security) |
| Auth | Email OTP via Nodemailer + Supabase Auth + Google / GitHub / LinkedIn OAuth |
| AI — NESTAi | OpenAI GPT-5.6 Luna + `text-embedding-3-small` for semantic search |
| AI — ATS | Groq, OpenAI, Anthropic, Google Gemini, Perplexity (user-selectable) |
| Email | Nodemailer over SMTP |
| Billing | Stripe |
| Rate Limiting | Upstash Redis (falls back to in-memory per instance) |
| Push Notifications | Web Push API, VAPID-signed via `web-push` |
| Document Parsing | `pdf-parse` (PDF text), `mammoth` (DOCX text + HTML), `pdfjs-dist` (annotation) |
| Virus Scanning | Cloudmersive (fail-open when key is absent) |
| Styling | Tailwind CSS v4 with dark mode |
| UI Primitives | Radix UI |
| Forms | React Hook Form + Zod |
| Error Monitoring | Sentry |
| Testing | Vitest (2121 tests, 122 files) + Playwright E2E (19 spec files) |

---

## Project Structure

```
web/
├── app/
│   ├── (auth)/              # Login, signup, forgot password
│   ├── (dashboard)/         # All protected pages (applications, NESTAi, salary, etc.)
│   ├── (public)/            # Landing, pricing, legal
│   ├── p/[username]/        # Public developer portfolio
│   └── api/
│       ├── applications/
│       ├── documents/       # Upload, preview, share, annotate, diff, ATS scan
│       ├── nesta-ai/        # Chat, parse-file, memory, analytics, RAG
│       ├── notifications/
│       ├── push/            # Web Push subscribe / unsubscribe
│       ├── profile/
│       ├── salary/
│       ├── stripe/
│       └── cron/            # Nine scheduled jobs (see Deployment)
├── components/
├── lib/
│   ├── email/
│   ├── features/            # AI token tracking, feature flags
│   ├── push/                # Push notification helpers
│   ├── security/            # OTP, CSRF, rate limiting, virus scanning
│   └── utils/               # Document parsing, salary helpers, date utilities
├── services/                # Data-access layer
├── tests/
│   ├── unit/                # Route handlers and lib utilities
│   ├── flows/               # Multi-step user journeys
│   └── e2e/                 # Playwright end-to-end specs
├── public/
│   ├── sw.js                # Service worker (caching + push)
│   └── manifest.json
└── proxy.ts                 # Middleware: auth, security headers, redirects

supabase/
└── migrations/              # 051 ordered SQL migrations
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- An SMTP server (for OTP emails)
- A Groq or OpenAI API key (for NESTAi)
- Stripe account — optional, for billing
- Upstash Redis — optional, falls back to in-memory rate limiting
- Cloudmersive API key — optional, virus scanning is skipped when absent

### 1. Clone and install

```bash
git clone https://github.com/nish1patel/jobnest.git
cd jobnest/web
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

<details>
<summary>Full variable reference</summary>

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Security — generate with: openssl rand -hex 32
CSRF_SECRET=
CRON_SECRET=

# SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
CONTACT_EMAIL=

# AI
GROQ_API_KEY=             # Used by ATS Scanner and NESTpro Audit
OPENAI_API_KEY=           # Required for NESTAi (GPT-5.6 Luna + embeddings)
ANTHROPIC_API_KEY=        # Optional — ATS provider
GEMINI_API_KEY=           # Optional — ATS provider
PERPLEXITY_API_KEY=       # Optional — ATS provider

# Web Push — generate with: npx web-push generate-vapid-keys
VAPID_EMAIL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# Stripe (optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_PRO_ANNUAL_PRICE_ID=

# Upstash Redis (optional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cloudmersive virus scanning (optional)
CLOUDMERSIVE_API_KEY=
```

</details>

### 3. Run database migrations

In the Supabase SQL editor, run the files in `supabase/migrations/` in order. A summary of what each range sets up:

| Range | What it adds |
|---|---|
| 000–010 | Core schema, auth, storage buckets, chat, billing |
| 011–022 | RLS policies, document library, activity logs, notifications, ATS fields |
| 023 | Full-text search via GIN-indexed `search_vector` |
| 024–030 | Developer identity, salary tracker, interview prep, PDF annotations |
| 031–046 | Portfolio, networking, AI usage tracking, feature flags, referrals |
| 047–048 | NESTAi RAG — pgvector embeddings, hybrid search, conversation memory |
| 049 | Extend full-text search to include job descriptions |
| 050 | `push_subscriptions` table for Web Push API |

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first account you create will have full access; Stripe and push notifications can be added later.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with Turbopack |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint (zero-warning policy) |
| `npm run typecheck` | TypeScript type check without emitting |
| `npm test` | Run all Vitest unit and flow tests |
| `npm run test:coverage` | Coverage report with enforced thresholds |
| `npm run test:e2e` | Playwright end-to-end tests (requires live credentials) |
| `npm run analyze` | Open the webpack bundle treemap |

---

## Testing

Unit and flow tests run fully offline — no Supabase connection, no API keys. Every external dependency (database, AI providers, email, Redis) is mocked with Vitest. Playwright E2E tests target a live staging instance and are skipped automatically when `PLAYWRIGHT_BASE_URL` is not set.

| Suite | Location | Covers |
|---|---|---|
| Unit | `tests/unit/` | API route handlers, library utilities, security helpers, schema validation |
| Flow | `tests/flows/` | Auth signup/login/recovery, NESTAi chat, Stripe billing, portfolio |
| E2E | `tests/e2e/` | Full user journeys: applications, search, mobile UX, ATS, documents |

**2121 tests across 122 files, all passing.** Coverage thresholds are set ~5 percentage points below measured values so they act as a regression gate without being brittle.

---

## Security

Security is treated as a first-class concern, not an afterthought.

| Area | Approach |
|---|---|
| Authentication | OTP tokens are SHA-256 hashed with timing-safe comparison; no plaintext storage |
| CSRF | `SameSite=Lax` cookies plus `verifyOrigin()` on every state-changing route |
| Rate limiting | Per-user Redis-backed limits (falls back to in-memory); enforced on all sensitive endpoints |
| File uploads | Magic-byte validation on every upload; MIME type allowlist; optional Cloudmersive virus scan |
| SSRF protection | DNS pre-resolution and post-redirect IP check on all URL-fetch routes |
| IDOR | Server-side ownership verification before every read and mutation |
| Path traversal | `..` segments rejected; storage paths are always scoped to `{user_id}/` |
| Row-level security | All tables enforce RLS via `auth.uid()` in Supabase |
| AI token caps | Atomic Redis reservation (INCRBY pipeline) prevents concurrent-request bypass |
| Headers | HSTS, nonce-based CSP, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin` |
| GitHub tokens | AES-256-GCM encrypted at rest |
| Cron jobs | Bearer token required on every cron endpoint; fail-closed on missing secret |
| DOCX preview | Mammoth HTML rendered in `<iframe sandbox="">` — scripts cannot execute regardless of document content |

Found a vulnerability? Please open a GitHub Security Advisory rather than a public issue.

---

## Deployment

### Vercel (recommended)

1. Import the repository and set the root directory to `web/`
2. Add all environment variables in the Vercel dashboard
3. Deploy — `vercel.json` configures cron jobs automatically

| Cron endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/process-deletions` | Daily 09:00 UTC | Complete grace-period account deletions |
| `/api/cron/overdue-reminders` | Daily 09:00 UTC | In-app notifications, emails, and push alerts |
| `/api/cron/weekly-digest` | Saturdays 21:00 (user timezone) | Weekly summary email |
| `/api/cron/follow-up-reminders` | Daily 09:00 UTC | Auto-generate follow-up reminders at day 7, 14, 21 |
| `/api/cron/re-engagement` | Daily 10:00 UTC | Re-engagement email after 14 days of inactivity |
| `/api/cron/github-sync` | Daily 04:00 UTC | Refresh pinned GitHub repositories |
| `/api/cron/purge-rejected-documents` | Daily 03:00 UTC | Delete files after 30-day rejection window |
| `/api/cron/nestai-reindex` | Daily 02:00 UTC | Refresh NESTAi embeddings for Pro users |

`CRON_SECRET` must be set in environment variables. All cron endpoints return `401` without it.

---

## Contributing

Contributions are welcome. Whether it's a bug fix, a feature, or documentation — open an issue first so we can discuss the approach before you invest time in a PR.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Write tests for any new behaviour
4. Ensure `npm test`, `npm run lint`, and `npm run typecheck` all pass
5. Open a pull request with a clear description of the change and why it matters

For significant changes, please open an issue to discuss before starting work.

---

## License

MIT — see [LICENSE](LICENSE) for details.

Built by [Nish Patel](https://nishpatel.dev)
