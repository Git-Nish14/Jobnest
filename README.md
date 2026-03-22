# Jobnest — Job Application Tracker

A modern, secure platform to organise and manage your entire job search. Built with Next.js 16, Supabase, and TypeScript.

**Live:** [jobnest.nishpatel.dev](https://jobnest.nishpatel.dev) · **A [Techifive](https://techifive.com) Product**

---

## Features

### Authentication & Security
- Email/Password login with **6-digit OTP verification** (via Nodemailer — not Supabase Auth emails)
- Secure signup and password reset via OTP
- Protected routes via Next.js middleware + Supabase SSR session refresh
- Security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Rate limiting on all auth and sensitive endpoints
- SHA-256 hashed OTP storage with timing-safe comparison
- Row Level Security (RLS) on all Supabase tables

### Profile
- View account info: email, join date, current plan, last password change date
- Update display name (initials-based avatar)
- **Change password** — 3-step OTP-verified flow: current password → email OTP → new password
- **Delete account** — OTP-confirmed soft delete with 30-day grace period (see below)

### Account Deletion (Grace Period)
Modelled after AWS / GitHub's approach — accounts are never immediately destroyed.

1. User requests deletion → OTP sent to email for confirmation
2. Deletion is **scheduled 30 days out** — account stays fully accessible
3. **7-day reminder emails** sent throughout the grace period
4. **24-hour final warning** email before permanent deletion
5. User can **cancel at any time** by signing back in (button in dashboard banner and profile page)
6. After 30 days, a daily cron job permanently deletes the account and all associated data via RLS cascade
7. Deletion request records IP address and optional user-provided reason for audit

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
- Claude/ChatGPT-style chat interface with collapsible conversation history sidebar
- Full access to all user data for contextual answers (applications, interviews, reminders, contacts, salary, templates, activity log)
- Conversation history — last 10 messages passed to the model for natural follow-ups
- Real-time rate-limit counter — shows requests remaining (X/5) with live countdown
- Chat sessions with rename and delete
- 5 requests per minute (server-enforced, client-visible)
- Powered by Groq (llama-3.1-8b-instant)

> **Note:** NESTAi can see which applications have resumes and cover letters attached (filenames visible). Full document text extraction (PDF/DOCX) is a work in progress.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL + RLS) |
| Storage | Supabase Storage |
| Auth | Custom OTP via Nodemailer + Supabase Auth |
| AI | Groq API (llama-3.1-8b-instant) |
| Email | Nodemailer (SMTP) |
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
│   │   └── profile/              # Account settings, change password, delete account
│   ├── api/
│   │   ├── auth/                 # send-otp, verify-otp, reset-password
│   │   ├── profile/              # update-name, change-password, delete-account,
│   │   │                         # reactivate-account, verify-password-send-otp
│   │   ├── cron/
│   │   │   └── process-deletions/ # Daily cron: reminders + permanent deletions
│   │   ├── nesta-ai/             # NESTAi chat, sessions, messages
│   │   ├── export/
│   │   ├── documents/
│   │   └── contact/
│   ├── contact/
│   ├── privacy/
│   └── terms/
├── components/
│   ├── ui/                       # Base UI: Button, Card, Badge, Skeleton, …
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
│   │   ├── document-parser.ts    # PDF/DOCX/TXT text extraction (WIP)
│   │   ├── fetch-retry.ts        # Fetch with retry + timeout
│   │   └── storage.ts            # Supabase Storage helpers
│   └── validations/              # Zod schemas (auth, application, forms)
├── services/                     # Server-side data access layer
├── hooks/                        # Custom React hooks
├── config/                       # Constants, env validation, routes
├── types/                        # TypeScript type definitions
├── vercel.json                   # Cron job schedule
└── middleware.ts                 # Route protection + security headers

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
CRON_SECRET=<openssl rand -hex 32>                   # Protects the cron endpoint

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
| 7 | `20240101000006_pending_deletions.sql` | Soft-delete table + change_password OTP purpose |
| 8 | `20240101000007_pending_deletions_improvements.sql` | Fixes UNIQUE constraint bug, adds audit columns, final warning tracking, delete_account OTP purpose |

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
npm run dev      # Development server (Turbopack)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

---

## Security

| Feature | Detail |
|---|---|
| OTP delivery | Sent via your own SMTP server (Nodemailer) — not Supabase Auth emails |
| OTP storage | SHA-256 hashed, service role only access |
| OTP comparison | Timing-safe (`crypto.timingSafeEqual`) |
| OTP purposes | `login`, `signup`, `password_reset`, `change_password`, `delete_account` |
| Rate limiting | In-memory per-key limits on all auth, profile, and AI endpoints |
| Security headers | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| RLS | Every table enforces row-level security tied to `auth.uid()` |
| CSRF | Token-based protection on mutating API routes |
| Cron auth | `Authorization: Bearer <CRON_SECRET>` required on `/api/cron/*` |
| Account deletion | OTP re-authentication required before scheduling deletion |
| Audit trail | IP address + optional reason recorded on every deletion request |

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project into Vercel — set root directory to `web/`
3. Add all environment variables (Settings → Environment Variables)
4. Deploy

Vercel automatically picks up `vercel.json` and schedules the cron job (`/api/cron/process-deletions` daily at 09:00 UTC). It also injects `Authorization: Bearer <CRON_SECRET>` on each invocation — make sure `CRON_SECRET` is set in your Vercel environment variables.

### Production Caveats

| Area | Limitation | Fix |
|---|---|---|
| Rate limiting | In-memory — resets on every cold start (Vercel serverless) | Replace `lib/security/rate-limit.ts` with [Upstash Redis](https://upstash.com) or Vercel KV |
| NESTAi doc cache | In-memory — not shared across function instances | Same — use Vercel KV or Redis |
| Sessions | Only current session is invalidated on account deletion request | Acceptable for current scale; Supabase session revocation is not instance-scoped |

---

## License

Private — All rights reserved

---

Built with precision by [Techifive](https://techifive.com)
