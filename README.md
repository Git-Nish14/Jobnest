# Jobnest - Job Application Tracker

A modern, secure platform to track and manage your job search. Built with Next.js 16, Supabase, and TypeScript.

**A [Techifive](https://techifive.com) Product**

## Features

### Authentication & Security
- **OTP-based authentication** via Nodemailer (not Supabase Auth emails)
- Email/Password login with 6-digit OTP verification
- Secure signup with email OTP verification
- Password reset via OTP verification
- Protected routes with Next.js middleware
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting on all auth endpoints
- SHA-256 hashed OTP storage
- Timing-safe OTP comparison

### Dashboard
- Overview statistics (total applications, interviews, offers, response rate)
- Application trends chart
- Status distribution pie chart
- Upcoming interviews widget
- Pending reminders widget
- Recent activity timeline

### Applications Management
- Full CRUD for job applications
- Filter by status, company, and date
- Track application details:
  - Company name and position
  - Application status (Applied, Interview, Offer, Rejected)
  - Salary information (expected/offered)
  - Job posting URL and location
  - Notes and documents
- Export applications to CSV/JSON

### Interviews
- Schedule and track interviews
- Multiple interview types (Phone Screen, Technical, Behavioral, On-site)
- Interview status tracking
- Meeting links and location support
- Preparation and post-interview notes

### Contacts
- Manage recruiters and hiring managers
- Store contact information (email, phone, LinkedIn)
- Associate contacts with companies

### Reminders
- Set follow-up reminders for applications
- Due date tracking with overdue alerts
- Mark reminders as completed

### Email Templates
- Create reusable email templates
- Variable placeholders (company, position, contact name)
- One-click copy to clipboard

### NESTAi Assistant
- AI-powered job search companion
- Analyze your applications and track progress
- Personalized insights and recommendations
- Chat history with session management
- Suggested quick questions (stats, success rate, pending responses)
- Rate limiting (5 questions per minute)

### Salary Tracking
- Track expected and offered salaries
- Compare compensation across applications

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Custom OTP + Supabase Auth |
| Email | Nodemailer |
| Styling | Tailwind CSS 4 |
| UI | Radix UI + Custom Components |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Notifications | Sonner |

## Project Structure

```
web/
├── app/
│   ├── (auth)/                 # Auth pages (login, signup, forgot-password)
│   ├── (dashboard)/            # Protected dashboard pages
│   │   ├── dashboard/
│   │   ├── applications/
│   │   ├── interviews/
│   │   ├── reminders/
│   │   ├── contacts/
│   │   ├── templates/
│   │   ├── salary/
│   │   └── nesta-ai/           # NESTAi Assistant chat interface
│   ├── api/
│   │   ├── auth/               # OTP endpoints (send-otp, verify-otp, reset-password)
│   │   ├── nesta-ai/           # NESTAi API (chat, sessions, messages)
│   │   ├── export/
│   │   ├── documents/
│   │   └── contact/
│   └── auth/callback/          # OAuth callback
├── components/
│   ├── ui/                     # Base UI components
│   ├── applications/           # Application components
│   ├── dashboard/              # Dashboard widgets
│   └── ...
├── lib/
│   ├── email/                  # Nodemailer service
│   ├── security/               # OTP, rate-limit, CSRF
│   ├── supabase/               # Client, server, admin
│   └── validations/            # Zod schemas
├── services/                   # API service functions
├── hooks/                      # Custom React hooks
├── types/                      # TypeScript types
└── middleware.ts               # Route protection + security headers

supabase/
└── migrations/                 # Database migrations
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm/yarn/pnpm/bun
- Supabase account
- SMTP server (for OTP emails)

### Environment Variables

Create a `.env.local` file in the `web/` directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# SMTP (for OTP emails)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
CONTACT_EMAIL=contact@example.com

# App
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### Database Setup

1. Create a new Supabase project
2. Run the migrations in order from `supabase/migrations/`:
   - `20240101000000_initial_schema.sql`
   - `20240101000001_storage_setup.sql`
   - `20240101000002_security_functions.sql`
   - `20240101000003_enhanced_features.sql`
   - `20240101000004_otp_codes.sql`
   - `20240101000005_chat_history.sql`

### Installation

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Security Features

- **OTP via Nodemailer**: All verification emails sent through your SMTP server
- **Hashed OTPs**: SHA-256 hashing for OTP storage
- **Rate Limiting**: Prevents brute force attacks
- **Timing-Safe Comparison**: Prevents timing attacks on OTP verification
- **Security Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Row Level Security**: Database-level access control via Supabase RLS
- **Service Role Isolation**: OTP table only accessible via service role

## Deployment

### Vercel (Recommended)

```bash
npm run build
```

Deploy to Vercel and set environment variables in the dashboard.

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## License

Private - All rights reserved

---

Built with care by [Techifive](https://techifive.com)
