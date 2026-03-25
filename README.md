# Jobnest — Job Application Tracker

A modern, secure platform to organise and manage your entire job search. Built with Next.js 16, Supabase, and TypeScript.

**Live:** [jobnest.nishpatel.dev](https://jobnest.nishpatel.dev) · **A [Techifive](https://techifive.com) Product**

---

## Features

### Authentication & Security
- Email/Password login with **6-digit OTP verification** (via Nodemailer — not Supabase Auth emails)
- **Google & GitHub OAuth** — one-click sign-in/sign-up, `/auth/callback` exchanges the code and sets the session
- Secure signup, password reset, and **change password** via OTP
- **Stay signed in** checkbox — unchecked sessions are terminated on next browser start via `sessionStorage` + `sb_rm` cookie
- **Cross-tab logout sync** — `AuthSync` component listens to `onAuthStateChange`; signing out in one tab redirects all open tabs instantly
- **Auto-redirect** — authenticated users visiting `/`, `/login`, `/signup`, or `/forgot-password` are redirected to `/dashboard`; `sb_rm=0` (session-only) sessions are exempt to prevent an AuthSync redirect loop
- Protected routes via Next.js 16 `proxy.ts` + Supabase SSR session refresh
- Security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Rate limiting on all auth and sensitive endpoints
- SHA-256 hashed OTP storage with timing-safe comparison
- Row Level Security (RLS) on all Supabase tables

### Profile Page
Two-column layout — sticky sidebar (avatar, stats, quick nav) + settings sections on the right.

- **Account info** — email, joined date, plan, last password change / auth method
- **Display name** — inline save
- **NESTAi Context** — free-text "About Me" injected into every NESTAi message for personalised answers
- **Notifications** — toggle switches for overdue reminder alerts and weekly digest
- **Change / Set password** — 3-step OTP-verified flow with OTP gating (password fields only appear after correct OTP)
  - OAuth-only users can set a password for the first time
  - "Forgot current password?" link bypasses current-password check
  - On success: 5-second countdown → signs out all devices → redirects to `/login`
- **Delete account** — OTP-confirmed soft delete with 30-day grace period

### Account Deletion (Grace Period)
Modelled after AWS / GitHub — accounts are never immediately destroyed.

1. User requests deletion → OTP sent to email for confirmation
2. Deletion **scheduled 30 days out** — account stays fully accessible
3. **7-day reminder emails** throughout the grace period
4. **24-hour final warning** email before permanent deletion
5. User can **cancel at any time** — button on profile page and dashboard banner
6. After 30 days, a daily cron job permanently deletes the account and all data via RLS cascade
7. IP address + optional user-provided reason recorded for audit

### Dashboard
- Overview stats — total applications, this week/month, active pipeline
- Weekly application trend bar chart
- Status distribution pie chart
- Upcoming interviews widget
- Pending reminders widget with overdue alerts
- Response rate card
- Recent applications list

### Applications
- Full CRUD for job applications
- Filter by status, company, location, and date range
- Sort by date, company, or position
- Per-application details: company, position, status, applied date, location, salary range, job URL, notes, tags
- Resume & cover letter upload (Supabase Storage)
- Export to CSV or JSON
- Company initial avatar on every card

### Interviews
- Schedule and track interviews per application
- Types: Phone Screen, Technical, Behavioral, On-site, Final
- Round tracking, duration, meeting URL, location, interviewer names
- Pre/post interview notes
- Status: Scheduled, Completed, Cancelled, Rescheduled

### Contacts
- Manage recruiters and hiring managers
- Store name, role, company, email, phone, LinkedIn URL, notes
- Mark primary contacts
- Associate contacts with applications

### Reminders
- Set follow-up reminders with due dates
- Types: Follow Up, Interview, Deadline
- Overdue detection and alerts
- Mark as completed

### Email Templates
- Create reusable templates by category (Follow Up, Thank You, Offer, Networking, General)
- Variable placeholders: `{{company}}`, `{{position}}`, `{{contact_name}}`
- One-click copy to clipboard

### Salary Tracker
- Track base salary, bonus, signing bonus, equity, benefits per application
- Record final offer and offer deadline
- Multi-currency support
- Comparison across all applications

### NESTAi — AI Job Search Assistant
- Claude/ChatGPT-style chat interface with collapsible + pinnable conversation sidebar
- Full access to all user data (applications, interviews, reminders, contacts, salary, templates, activity log)
- **Streaming responses** — tokens appear word-by-word; **Stop button** (■) aborts mid-stream, preserving partial response
- **Conversation history** — last 100 messages passed to the model for natural follow-ups
- **Pin chats** — pin important sessions to the top of the sidebar
- **Edit messages** — click the pencil on any user message, edit inline, re-send from that point (messages after it are pruned from DB and local state)
- **File attachments** — attach PDF, DOCX, TXT, MD (up to 5 MB); chip shows loading/error/ready state; non-blocking (you can still chat while a PDF is being parsed)
  - **View attached document** — click the file card in the chat to open a full preview modal with the extracted text
  - Attachment card persists on session reload (stored in `chat_messages.metadata` JSONB)
- **Inline markdown rendering** — headers, bold, italic, inline code, fenced code blocks (dark theme), lists, blockquotes, streaming cursor
- **Real-time rate-limit counter** — pip dots showing X/5 remaining with live countdown
- **Suggested follow-up questions** — tappable chips below every assistant response
- **User About Me** injected into the system prompt if set on the profile page
- **Smart context trimming** — token budget of 124,500 tokens enforced via a 4-step progressive trim: history → 20 messages, docs → 1,000 chars each, docs omitted + activity → 20 entries, hard truncation
- Chat sessions with confirm-before-delete and rename (Enter/Escape keyboard shortcuts)
- 5 requests per minute (server-enforced)
- Powered by Groq (`llama-3.3-70b-versatile`)

> NESTAi can read, quote, and summarise uploaded resumes and cover letters. Full text is extracted server-side (PDF/DOCX/TXT) and injected into the context.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router, Turbopack) |
| Language | TypeScript 5.9 |
| Database | Supabase (PostgreSQL + RLS) |
| Storage | Supabase Storage |
| Auth | Custom OTP via Nodemailer + Supabase Auth (email/password + Google/GitHub OAuth) |
| AI | Groq API (`llama-3.3-70b-versatile`) |
| Email | Nodemailer (SMTP) |
| Font | Geist Sans / Geist Mono (dashboard) · Newsreader + Manrope (auth pages) via `next/font/google` |
| Styling | Tailwind CSS 4 (light-only) |
| UI | Radix UI primitives + custom components |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Notifications | Sonner |
| Cron | Vercel Cron Jobs |

---

## Project Structure

```
web/
├── app/
│   ├── (auth)/                   # Login, signup, forgot-password
│   ├── (dashboard)/              # Protected dashboard pages
│   │   ├── dashboard/
│   │   ├── applications/
│   │   ├── interviews/
│   │   ├── reminders/
│   │   ├── contacts/
│   │   ├── templates/
│   │   ├── salary/
│   │   ├── nestai/
│   │   └── profile/              # Account settings, password, delete account
│   ├── api/
│   │   ├── auth/                 # send-otp, verify-otp, reset-password
│   │   ├── profile/              # update-name, change-password, delete-account,
│   │   │                         # reactivate-account, verify-password-send-otp,
│   │   │                         # update-about-me, update-notifications, verify-change-otp
│   │   ├── cron/
│   │   │   └── process-deletions/ # Daily cron: 7-day reminders, 24h final warning, permanent deletion
│   │   ├── nesta-ai/             # Chat API (streaming), sessions, messages, parse-file
│   │   ├── export/
│   │   ├── documents/
│   │   └── contact/
│   ├── auth/
│   │   └── callback/             # OAuth code exchange
│   ├── contact/
│   ├── privacy/
│   └── terms/
├── components/
│   ├── ui/                       # Base UI: Button, Card, Badge, Skeleton, …
│   ├── auth/                     # AuthSync (cross-tab logout + remember-me)
│   ├── common/                   # Loading, ErrorBoundary, skeleton screens
│   ├── layout/                   # Navbar, Footer, LayoutWrapper
│   ├── profile/                  # ProfileClient, DeletionBanner
│   ├── applications/
│   ├── dashboard/
│   ├── interviews/
│   ├── reminders/
│   ├── contacts/
│   ├── templates/
│   ├── activity/
│   └── tags/
├── lib/
│   ├── api/                      # Error handling, response helpers
│   ├── email/                    # Nodemailer — OTP + deletion lifecycle emails
│   ├── security/                 # OTP generation, rate-limit, sanitization, CSRF
│   ├── supabase/                 # Client, server, admin Supabase clients
│   ├── utils/
│   │   ├── document-parser.ts    # PDF/DOCX/TXT text extraction + extractTextFromBuffer
│   │   ├── fetch-retry.ts        # Fetch with retry + timeout
│   │   └── storage.ts            # Supabase Storage helpers
│   └── validations/              # Zod schemas (auth, application, forms, API)
├── services/                     # Server-side data access layer
├── hooks/                        # Custom React hooks
├── config/                       # Constants, env validation, routes
├── types/                        # TypeScript type definitions
├── vercel.json                   # Cron job schedule
└── proxy.ts                      # Route protection + security headers (Next.js 16 proxy convention)

supabase/
└── migrations/                   # SQL migration files (run in order)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase project
- SMTP server (for OTP and lifecycle emails)
- Groq API key (for NESTAi)
- Google OAuth credentials (optional, for Google sign-in)
- GitHub OAuth app (optional, for GitHub sign-in)

### Environment Variables

Copy `web/.env.local.example` to `web/.env.local` and fill in all values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# App URLs (both should point to your production domain)
NEXT_PUBLIC_SITE_URL=https://jobnest.nishpatel.dev   # SEO metadata, sitemap, OG tags
NEXT_PUBLIC_APP_URL=https://jobnest.nishpatel.dev    # Transactional email links

# Security
CSRF_SECRET=<openssl rand -hex 32>
CRON_SECRET=<openssl rand -hex 32>                   # Protects /api/cron/* — required

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
CONTACT_EMAIL=contact@yourdomain.com

# NESTAi (Groq)
GROQ_API_KEY=gsk_your_groq_api_key
```

> **Tip:** Generate secrets with `openssl rand -hex 32`

### OAuth Setup (Google & GitHub)

**Google:**
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client
2. Authorized JavaScript origins: `https://jobnest.nishpatel.dev` + `http://localhost:3000`
3. Authorized redirect URIs: `https://jobnest.nishpatel.dev/auth/callback`, `https://<ref>.supabase.co/auth/v1/callback`, + localhost equivalents
4. Supabase dashboard → Authentication → Providers → Google → paste Client ID + Secret

**GitHub:**
1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Homepage URL: `https://jobnest.nishpatel.dev`
3. Callback URL: `https://<ref>.supabase.co/auth/v1/callback`
4. Supabase dashboard → Authentication → Providers → GitHub → paste Client ID + Secret

### Database Setup

Run the migration files in order from `supabase/migrations/` via the Supabase SQL editor:

| # | File | Purpose |
|---|---|---|
| 1 | `20240101000000_initial_schema.sql` | Core tables (job_applications) and RLS policies |
| 2 | `20240101000001_storage_setup.sql` | Storage bucket configuration |
| 3 | `20240101000002_security_functions.sql` | Security helper functions |
| 4 | `20240101000003_enhanced_features.sql` | Tags, salary, contacts, reminders, templates |
| 5 | `20240101000004_otp_codes.sql` | OTP verification table |
| 6 | `20240101000005_chat_history.sql` | NESTAi session and message tables |
| 7 | `20240101000006_pending_deletions.sql` | Soft-delete table + `change_password` OTP purpose |
| 8 | `20240101000007_pending_deletions_improvements.sql` | Fixes UNIQUE constraint bug, adds audit columns, `delete_account` OTP purpose |
| 9 | `20240101000008_chat_pin.sql` | Adds `is_pinned` to `chat_sessions` |
| 10 | `20240101000009_chat_message_metadata.sql` | Adds `metadata` JSONB to `chat_messages` (file attachment cards) |

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
npm run typecheck     # TypeScript type check (tsc --noEmit)
npm test              # Run all Vitest tests (unit + flow)
npm run test:watch    # Vitest in watch mode
npm run test:coverage # Vitest with V8 coverage report
```

---

## Testing

All tests run with **Vitest** — no browser or external service required.

```bash
npm test              # Run all tests once
npm run test:coverage # Coverage report
```

| Suite | Location | What it covers |
|---|---|---|
| Unit | `tests/unit/` | lib utilities (errors, rate-limit, OTP, fetch-retry, Zod schemas), every API route handler, proxy redirect logic |
| E2E flows | `tests/flows/` | Full user journeys: login, signup, forgot-password (3-step), change-password (3-step OTP), delete + reactivate account, NESTAi chat + file upload |

All external dependencies (Supabase, Nodemailer, Groq) are mocked — no `.env` required to run tests.

### CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and pull request:

1. **Typecheck** — `tsc --noEmit`
2. **Test** — `vitest run` (all 253 tests)
3. **Build** — `next build` (depends on steps 1 + 2 passing)

---

## Security

| Feature | Detail |
|---|---|
| OTP delivery | Sent via your own SMTP server (Nodemailer) — not Supabase Auth emails |
| OTP storage | SHA-256 hashed, service role only access |
| OTP comparison | Timing-safe (`crypto.timingSafeEqual`) |
| OTP purposes | `login`, `signup`, `password_reset`, `change_password`, `delete_account` |
| OTP gating | Password fields only shown after OTP is verified server-side (pre-verify endpoint) |
| Rate limiting | In-memory per-key limits on all auth, profile, and AI endpoints |
| Security headers | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| RLS | Every table enforces row-level security tied to `auth.uid()` |
| CSRF | Token-based protection on mutating API routes |
| Cron auth | `Authorization: Bearer <CRON_SECRET>` required — **fail-closed** (endpoint locked if env var not set) |
| Account deletion | OTP re-authentication required before scheduling deletion |
| Audit trail | IP address + optional reason recorded on every deletion request |
| Password change | Signs out all devices on success; `password_changed_at` saved via admin client (bypasses invalidated session) |
| OAuth sessions | `sb_rm` cookie controls remember-me behaviour; `AuthSync` enforces session-only mode on browser restart |
| CVEs patched | Next.js 16.2.1 fixes HTTP request smuggling, CSRF bypass, DoS (from 16.1.6) |

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project into Vercel — set root directory to `web/`
3. Add all environment variables (Settings → Environment Variables)
4. Deploy

Vercel automatically picks up `vercel.json` and schedules the cron job (`/api/cron/process-deletions` daily at 09:00 UTC). It injects `Authorization: Bearer <CRON_SECRET>` automatically — **`CRON_SECRET` must be set or the endpoint will return 401 for all callers including Vercel itself.**

### Production Caveats

| Area | Limitation | Fix |
|---|---|---|
| Rate limiting | In-memory — resets on every cold start; multiple instances don't share state | Replace `lib/security/rate-limit.ts` with [Upstash Redis](https://upstash.com) or Vercel KV |
| NESTAi doc cache | In-memory — not shared across function instances | Same — use Vercel KV or Redis |
| Sessions on deletion | Only current session is invalidated on account deletion request | Acceptable for current scale |

---

## License

Private — All rights reserved

---

Built with precision by [Techifive](https://techifive.com)
