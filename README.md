# Jobnest — Job Application Tracker

A modern, secure platform to organise and manage your entire job search. Built with Next.js 16, Supabase, and TypeScript.

**Live:** [jobnest.nishpatel.dev](https://jobnest.nishpatel.dev) · **By [Nish Patel](https://nishpatel.dev)**

> Found a bug or have a suggestion? [Open an issue](https://github.com/Git-Nish14/Jobnest/issues) · [View on GitHub](https://github.com/Git-Nish14/Jobnest)

---

## Features

### Authentication & Security
- Email/Password login with **6-digit OTP verification** (via Nodemailer — not Supabase Auth emails)
- **Google & GitHub OAuth** — one-click sign-in/sign-up, `/auth/callback` exchanges the code and sets the session
- **Age verification** — users must confirm they are **18 years of age or older** at sign-up (checkbox required before email/OAuth registration proceeds)
- **Terms & Privacy acceptance** — users must explicitly accept the Terms of Service and Privacy Policy before creating an account; OAuth sign-up is also blocked until both boxes are checked
- Secure signup, password reset, and **change password** via OTP
- **Stay signed in for 30 days** checkbox — checked (default): `sb_rm=1`, 30-day persistent session; unchecked: `sb_rm=0`, session terminated on next browser start via `sessionStorage` + `sb_rm` cookie. In production the cookie uses the `__Host-` prefix (binds to exact host, blocks subdomain injection)
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
- **Download your data** — GDPR Art. 20 data portability; exports all personal data as a dated JSON file (rate-limited to 3/day)
- **Billing portal** — Pro subscribers can manage their plan, update payment method, and view invoices via the Stripe customer portal (GET `/api/stripe/portal`)
- **Switch billing interval** — mid-cycle monthly ↔ annual switch with Stripe proration (`POST /api/stripe/update-subscription`); charge/credit appears on next invoice

### Account Deletion (Grace Period)
Modelled after AWS / GitHub — accounts are never immediately destroyed.

1. User requests deletion → OTP sent to email for confirmation
2. Deletion **scheduled 30 days out** — account stays fully accessible
3. **7-day reminder emails** throughout the grace period
4. **24-hour final warning** email before permanent deletion
5. User can **cancel at any time** — button on profile page and dashboard banner
6. After 30 days, a daily cron job permanently deletes the account and all data via RLS cascade
7. Post-deletion **right-to-erasure verification** — cron queries 9 data tables to confirm no orphaned rows remain; logs a warning if any are found
8. IP address + optional user-provided reason recorded for audit

### Design System — Intellectual Atelier
A warm, editorial design language used consistently across every page of the application.

- **Palette** — terracotta primary `#99462a`, warm parchment surfaces `#faf9f7` / `#f4f3f1`, on-surface `#1a1c1b`
- **Typography** — Newsreader (serif, headings + italic accents) + Manrope (sans-serif, body)
- **Buttons** — pill-shaped (`rounded-full`), terracotta filled or outlined variants
- **Inputs** — warm surface `#f4f3f1`, terracotta focus ring, atelier border
- **Cards** — `db-content-card` (white + subtle warm shadow), `db-app-card` (with left-edge accent bar per status)
- **Dialogs / dropdowns** — `bg-[#faf9f7]`, `rounded-2xl` / `rounded-xl`, soft `backdrop-blur` overlay
- **Status badges** — tonal atelier colours per status (Interview, Phone Screen, Applied, Offer, Rejected, Withdrawn)
- **Loading skeletons** — warm `#e3e2e0` shimmer blocks matching real card structure
- **Page headers** — Newsreader large title (`db-page-title`) + subtitle + right-aligned pill action button

### Mobile Responsive System
Full mobile-first responsive implementation across all pages:

- **Bottom tab bar** — fixed `BottomTabBar` (Overview, Applications, Interviews, NESTAi) on mobile only (`md:hidden`), Atelier-styled with safe-area-inset-bottom support
- **NESTAi sidebar** — full-screen drawer on mobile (`w-full`), stops above the bottom tab bar; collapses to inline panel on desktop
- **Application detail sticky bar** — Edit + Back actions in a fixed bar above the tab bar on mobile (`db-mobile-action-bar`)
- **Salary table** — horizontal scroll with `db-scroll-x` and `min-w` to prevent column squishing on small screens
- **Viewport** — `viewport-fit=cover` for correct `env(safe-area-inset-*)` on notched devices (iPhone, Android)

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
- Filter by status, company, location, and date range with **400ms debounced live search** (no Enter required)
- Sort by date, company, or position (with icon-per-sort visual indicator)
- Per-application details: company, position, status, applied date, location, salary range, job URL, notes, tags
- Resume & cover letter upload (Supabase Storage)
- Export to CSV or JSON
- Company initial avatar on every card
- Card actions (Edit, Delete, External link) always visible on mobile

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
- **File attachments** — attach PDF, DOCX, TXT, MD, and **images** (JPG, PNG, HEIC, WEBP, etc., up to 5 MB); chip shows loading/error/ready state; non-blocking. On iOS Safari the picker correctly shows camera, photo library, and Files options via `accept="image/*,.pdf,..."`.
  - **View attached document** — click the file card in the chat to open a full preview modal with the extracted text
  - Attachment card persists on session reload (stored in `chat_messages.metadata` JSONB)
- **Inline markdown rendering** — headers, bold, italic, inline code, fenced code blocks (dark theme), lists, blockquotes, streaming cursor
- **Real-time rate-limit counter** — pip dots showing X/5 remaining with live countdown
- **Suggested follow-up questions** — tappable chips below every assistant response
- **User About Me** injected into the system prompt if set on the profile page
- **Smart context trimming** — token budget of 124,500 tokens enforced via a 4-step progressive trim: history → 20 messages, docs → 1,000 chars each, docs omitted + activity → 20 entries, hard truncation
- Chat sessions with **modal confirm-before-delete** (Radix UI Dialog — not dismissed by outside clicks) and rename (Enter/Escape keyboard shortcuts)
- **5 req/min free · 30 req/min Pro** — enforced server-side; plan read from `subscriptions` table via admin client (fail-closed, never grant Pro accidentally)
- Powered by Groq (`llama-3.3-70b-versatile`)

> NESTAi can read, quote, and summarise uploaded resumes and cover letters. Full text is extracted server-side (PDF/DOCX/TXT) and injected into the context.

### Notifications
Persistent in-app notification system — all writes via service-role, no user-level INSERT policy.

- **Notification bell** in dashboard Navbar — polls `/api/notifications/count` every 60 s; shows live badge (overdue reminders + upcoming interviews within 24 h); popover with quick links; "View all →" navigates to `/notifications`
- **Notifications page** (`/notifications`) — All / Unread / Read filter tabs; per-card mark-read toggle, delete; "Mark all read" + "Clear all" bulk actions; cursor-based pagination; fully optimistic UI
- **`notifications` table** (migration 20) — RLS-enforced (select/update/delete by owner, insert by service-role); partial unique index deduplicates by `(user_id, source_type, source_id)` so cron re-runs are always idempotent
- **Daily cron** (09:00 UTC) creates notifications for ALL users: one per overdue reminder + one per upcoming interview within 24 h; sends overdue reminder EMAIL only to users who opted into `notification_prefs.overdue_reminders`
- **Email types** — weekly digest (Mondays), overdue reminder alert (daily for opted-in users), deletion lifecycle (scheduled / 7-day reminder / 24 h final warning / reactivated), payment failed dunning

### Billing & Payments (Stripe)
Core billing fully wired: checkout, 4 webhook events, billing portal, dunning email, 30-day trial, annual toggle.

- **Plan enforcement** — `lib/auth/plan.ts` reads `subscriptions` via admin client (not JWT claims); `requirePro()` throws HTTP 402 `UPGRADE_REQUIRED`; fails CLOSED (returns "free" on any DB error)
- **Student discount** — `GET /api/stripe/student-verify` server-side allow-list of 16 academic TLDs (`.edu`, `.ac.uk`, `.edu.au`, etc.); `PricingPlans` auto-detects eligible email on mount and shows verification badge; non-`.edu` users can apply promo codes at Stripe checkout
- **Proration** — `POST /api/stripe/update-subscription` switches billing interval mid-cycle with `proration_behavior: "create_prorations"`; no-op guard prevents double charges if already on target price

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
| Billing | Stripe (checkout sessions, webhooks, customer portal, dunning) |
| Font | Geist Sans / Geist Mono (public/root) · Newsreader + Manrope (auth + dashboard) via `next/font/google` |
| Styling | Tailwind CSS 4 + dark mode (`prefers-color-scheme` + localStorage toggle) — Intellectual Atelier design system |
| UI | Radix UI primitives + custom atelier-themed components |
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
│   ├── (public)/                 # Public marketing + legal pages (shared LandingHeader + LandingFooter)
│   │   ├── layout.tsx            # Canonical public layout — LandingHeader + LandingFooter + fonts
│   │   ├── page.tsx              # Landing page (/)
│   │   ├── pricing/
│   │   ├── privacy/
│   │   ├── terms/
│   │   ├── contact/
│   │   └── cookies/
│   ├── api/
│   │   ├── auth/                 # send-otp, verify-otp, reset-password
│   │   ├── profile/              # update-name, change-password, delete-account,
│   │   │                         # reactivate-account, verify-password-send-otp,
│   │   │                         # update-about-me, update-notifications, verify-change-otp,
│   │   │                         # export-data (GDPR data portability)
│   │   ├── cron/
│   │   │   ├── process-deletions/  # Daily 09:00 UTC: reminders, final warning, permanent deletion
│   │   │   ├── overdue-reminders/  # Daily 09:00 UTC: in-app notifications + opted-in emails
│   │   │   └── weekly-digest/      # Mondays 08:00 UTC: personalised digest email
│   │   ├── nesta-ai/             # Chat API (streaming), sessions, messages, parse-file
│   │   ├── notifications/        # GET list, DELETE all, PATCH/DELETE [id], POST read-all
│   │   ├── export/
│   │   ├── documents/
│   │   ├── stripe/               # checkout, webhook (4 events), portal, student-verify, update-subscription
│   │   └── contact/
│   ├── auth/
│   │   └── callback/             # OAuth code exchange
│   └── onboarding/
├── components/
│   ├── ui/                       # Base UI: Button, Card, Badge, Skeleton, …
│   ├── auth/                     # AuthSync (cross-tab logout + remember-me)
│   ├── common/                   # Loading, ErrorBoundary, skeleton screens
│   ├── layout/                   # Navbar, Footer, LandingHeader, LandingFooter, NotificationBell, BottomTabBar
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
│   ├── api/                      # Error handling, response helpers (incl. ApiError.paymentRequired 402)
│   ├── auth/                     # plan.ts — getUserPlan + requirePro (fail-closed plan enforcement)
│   ├── email/                    # Nodemailer — OTP, deletion lifecycle, overdue reminders, dunning
│   ├── notifications/            # create.ts — admin-client idempotent upsert helper
│   ├── env.ts                    # Startup env validation (fails loudly on missing vars)
│   ├── security/                 # OTP, Redis rate-limit, sanitization, CSRF + verifyOrigin
│   ├── stripe.ts                 # Stripe singleton + isStripeConfigured helpers
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
├── instrumentation.ts            # Next.js startup hook — calls validateEnv() on server start
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
- Stripe account with a Pro product + price (for billing — the app degrades gracefully without it)
- Upstash Redis database (optional — rate limiter falls back to in-memory without it)
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

# Stripe (billing — omit to disable; app shows "Coming Soon" on pricing page)
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret   # GET from Stripe dashboard after adding endpoint
STRIPE_PRO_PRICE_ID=price_your_monthly_price_id
STRIPE_PRO_ANNUAL_PRICE_ID=price_your_annual_price_id   # optional — enables annual toggle

# Upstash Redis (optional — enables persistent cross-instance rate limiting)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

> **Tip:** Generate secrets with `openssl rand -hex 32`

#### Stripe Setup

1. Create a product in [Stripe Dashboard](https://dashboard.stripe.com/products) → add a recurring monthly price (and optionally annual)
2. Copy the **Price IDs** into `STRIPE_PRO_PRICE_ID` / `STRIPE_PRO_ANNUAL_PRICE_ID`
3. Add a webhook endpoint in Stripe Dashboard → Developers → Webhooks:
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy the **Webhook signing secret** into `STRIPE_WEBHOOK_SECRET`
5. Enable the **Customer Portal** in Stripe Dashboard → Settings → Billing → Customer portal

For local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

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
| 11 | `20240101000010_subscriptions.sql` | Stripe billing: `subscriptions` table (plan, status, period dates) |

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
| Unit | `tests/unit/` | lib utilities (errors, rate-limit async/Redis, OTP, CSRF verifyOrigin, fetch-retry, Zod schemas), every API route handler (auth, profile, documents, export, Stripe webhook + portal, GDPR export, cron + erasure verification), proxy redirect logic |
| Mobile / UX | `tests/unit/mobile/` | Structural tests for responsive layout (BottomTabBar, NESTAi drawer, sticky action bar), aria labels, skeleton sync, CSS tokens, prefers-reduced-motion |
| E2E flows | `tests/flows/` | Full user journeys: login (remember-me cookie), signup (age + terms), forgot-password (3-step), change-password (3-step OTP), delete + reactivate account, NESTAi chat + file upload, **Stripe billing** (checkout → webhook activation → portal → payment failure dunning → cancellation) |

All external dependencies (Supabase, Nodemailer, Groq, Stripe) are mocked — no `.env` required to run tests.

### CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and pull request:

1. **Typecheck** — `tsc --noEmit`
2. **Test** — `vitest run` (36 test files, 426 tests)
3. **Build** — `next build` (depends on steps 1 + 2 passing)

---

## Security

| Feature | Detail |
|---|---|
| OTP delivery | Sent via your own SMTP server (Nodemailer) — not Supabase Auth emails |
| OTP storage | SHA-256 hashed (`hashOTP` in `lib/security/otp.ts`), service role only access |
| OTP comparison | Timing-safe (`crypto.timingSafeEqual`) via `secureCompare` in `lib/security/otp.ts` |
| OTP purposes | `login`, `signup`, `password_reset`, `change_password`, `delete_account` |
| OTP gating | Password fields only shown after OTP is verified server-side (pre-verify endpoint) |
| Rate limiting — auth | Dual-layer: **IP-level** (10/min) + **per-email** (3/min) on send-otp; prevents inbox flooding of arbitrary victims |
| Rate limiting — general | **Redis-backed** (Upstash REST API) when `UPSTASH_REDIS_REST_URL` is set; falls back to in-memory with a 10 000-key cap. Redis survives cold starts and is shared across all function instances |
| IP extraction | `x-real-ip` preferred; last entry in `x-forwarded-for` chain used as fallback (first entry is user-controlled and spoofable) |
| Open redirect protection | `proxy.ts` validates the `redirect` param — rejects protocol-relative (`//evil.com`) and scheme-like paths |
| Prefix collision fix | `/api/contact` matched exactly (not as a prefix) — prevents accidentally exposing unrelated routes as public |
| Password reset lookup | Uses targeted Supabase REST `filter=email=eq.{email}` fetch — replaces `listUsers()` O(n) scan that silently failed beyond page 1 |
| Security headers | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Document serving | Content-Type derived from file extension; `Content-Disposition: attachment` forced — prevents stored XSS via uploaded HTML/SVG |
| RLS | Every table enforces row-level security tied to `auth.uid()` |
| CSRF | `SameSite=Lax` on all Supabase session cookies + `verifyOrigin()` on all 8 profile mutation routes (blocks cross-origin POST if `Origin` header is present and doesn't match `NEXT_PUBLIC_APP_URL`) |
| Cron auth | `Authorization: Bearer <CRON_SECRET>` required — **fail-closed** (endpoint locked if env var not set) |
| Account deletion | OTP re-authentication required before scheduling deletion |
| Audit trail | IP address + optional reason recorded on every deletion request |
| Password change | Signs out all devices on success; `password_changed_at` saved via admin client (bypasses invalidated session) |
| OAuth sessions | `sb_rm` cookie controls remember-me behaviour; uses `__Host-` prefix in production (binds to exact host, prevents subdomain injection); `AuthSync` enforces session-only mode on browser restart |
| Startup validation | `instrumentation.ts` calls `lib/env.ts` on server start — throws immediately if required env vars are missing rather than failing silently on first request |
| CVEs patched | Next.js 16.2.1 fixes HTTP request smuggling, CSRF bypass, DoS (from 16.1.6); pdf-parse upgraded 1.x → 2.x |
| Stripe webhook | App Router route — body not auto-parsed; `request.text()` delivers raw bytes for Stripe signature verification without any config flag |
| Email HTML | All user-controlled strings escaped via `esc()` before HTML interpolation; table-based layout (Outlook compatible); dark-mode via `@media (prefers-color-scheme: dark)` |
| Plan enforcement | `lib/auth/plan.ts` reads `subscriptions` via service-role (cannot be spoofed via JWT); fails CLOSED — returns "free" on any DB error, never accidentally grants Pro access |
| Notification inserts | No user-level INSERT policy on `notifications` table — only service-role (cron) creates records; users can only read/update/delete their own rows |
| Student verify | `.edu` domain check performed server-side on Supabase Auth email — cannot be spoofed by client input; rate-limited 10 req/min |

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project into Vercel — set root directory to `web/`
3. Add all environment variables (Settings → Environment Variables)
4. Deploy

Vercel automatically picks up `vercel.json` and schedules three cron jobs:
- `/api/cron/process-deletions` — daily 09:00 UTC (deletion reminders + permanent erasure)
- `/api/cron/overdue-reminders` — daily 09:00 UTC (in-app notifications + optional emails)
- `/api/cron/weekly-digest` — Mondays 08:00 UTC (personalised digest email)

Vercel injects `Authorization: Bearer <CRON_SECRET>` automatically — **`CRON_SECRET` must be set or all cron endpoints return 401, including for Vercel itself.**

### Production Caveats

| Area | Limitation | Fix |
|---|---|---|
| Rate limiting | Falls back to in-memory when `UPSTASH_REDIS_REST_URL` is not set — resets on cold starts | Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (free tier on [upstash.com](https://upstash.com)) |
| NESTAi doc cache | In-memory — not shared across function instances | Use Vercel KV or the same Upstash Redis database |
| Sessions on deletion | Only current session is invalidated on account deletion request | Acceptable for current scale |

---

## Contributing / Issues

Found a bug or have a suggestion? [Open an issue on GitHub](https://github.com/Git-Nish14/Jobnest/issues).

---

## License

Private — All rights reserved

---

Built by [Nish Patel](https://nishpatel.dev)
