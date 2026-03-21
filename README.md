# Jobnest — Job Application Tracker

A modern, secure platform to organise and manage your entire job search. Built with Next.js 16, Supabase, and TypeScript.

**A [Techifive](https://techifive.com) Product**

---

## Features

### Authentication & Security
- Email/Password login with **6-digit OTP verification** (via Nodemailer — not Supabase Auth emails)
- Secure signup and password reset via OTP
- Google & GitHub OAuth buttons present in UI (disabled — backend not yet configured)
- Protected routes via Next.js middleware
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Rate limiting on all auth endpoints
- SHA-256 hashed OTP storage with timing-safe comparison
- Row Level Security (RLS) on all Supabase tables

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
- Per-application details:
  - Company, position, status, applied date
  - Location, salary range, job URL
  - Notes and tags
  - Resume & cover letter upload (stored in Supabase Storage)
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
- Associate contacts with specific applications

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
- Claude/ChatGPT-style chat interface with a collapsible conversation history sidebar
- Full access to all user data for contextual answers:
  - All job applications (notes, salary, tags, document filenames)
  - All interviews (notes, interviewer names, round details)
  - All reminders, contacts, email templates, salary details
  - Complete activity log
- **Conversation history** — last 10 messages passed to the model so follow-up questions work naturally
- **Real-time rate-limit counter** — pip dots showing requests remaining (X/5), live countdown from the first message of each window
- Chat sessions with rename and delete
- 5 requests per minute (server-enforced, client-visible in real time)
- Powered by Groq (llama-3.1-8b-instant)

> **Note:** NESTAi can see which applications have resumes and cover letters attached (filenames visible). Full text extraction from uploaded documents (PDF/DOCX) is a work in progress and may not be reliable across all file types.

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
| Email | Nodemailer |
| Styling | Tailwind CSS 4 (light-only) |
| UI | Radix UI primitives + custom components |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Notifications | Sonner |

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
│   │   └── nestai/               # NESTAi Assistant (route: /nestai)
│   ├── api/
│   │   ├── auth/                 # send-otp, verify-otp, reset-password
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
│   ├── email/                    # Nodemailer service
│   ├── security/                 # OTP, rate-limit, sanitization, CSRF
│   ├── supabase/                 # Client, server, admin clients
│   ├── utils/
│   │   ├── document-parser.ts    # PDF/DOCX/TXT text extraction (WIP)
│   │   └── storage.ts            # Supabase Storage helpers
│   └── validations/              # Zod schemas
├── services/                     # Data access layer
├── hooks/                        # Custom React hooks
├── config/                       # Constants, env, routes
├── types/                        # TypeScript type definitions
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
- SMTP server (for OTP emails)
- Groq API key (for NESTAi)

### Environment Variables

Create `web/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# SMTP — used for OTP verification emails
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
CONTACT_EMAIL=contact@yourdomain.com

# App
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# NESTAi (Groq)
GROQ_API_KEY=your_groq_api_key
```

### Database Setup

1. Create a new Supabase project
2. Run the migration files in order from `supabase/migrations/`:

| Order | File | Purpose |
|---|---|---|
| 1 | `20240101000000_initial_schema.sql` | Core tables and RLS policies |
| 2 | `20240101000001_storage_setup.sql` | Storage bucket configuration |
| 3 | `20240101000002_security_functions.sql` | Security helper functions |
| 4 | `20240101000003_enhanced_features.sql` | Tags, salary, contacts, reminders |
| 5 | `20240101000004_otp_codes.sql` | OTP verification table |
| 6 | `20240101000005_chat_history.sql` | NESTAi session and message tables |

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
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

---

## Security

| Feature | Detail |
|---|---|
| OTP delivery | Sent via your own SMTP server (Nodemailer) |
| OTP storage | SHA-256 hashed, service role only |
| OTP comparison | Timing-safe (`crypto.timingSafeEqual`) |
| Rate limiting | In-memory per-IP/user limits on auth and AI endpoints |
| Security headers | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| RLS | All tables enforce row-level security tied to `auth.uid()` |
| CSRF | Token-based protection on mutating API routes |

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import into Vercel, set root directory to `web/`
3. Add all environment variables from `.env.local`
4. Deploy

---

## License

Private — All rights reserved

---

Built with precision by [Techifive](https://techifive.com)
