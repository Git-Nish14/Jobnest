# JobNest - Job Application Tracker

A comprehensive platform to track and manage your job search. Built with Next.js 16, Supabase, and TypeScript.

## Features

### Authentication
- Email/Password authentication with Supabase Auth
- Email verification flow
- Password reset (forgot password / reset password)
- Periodic re-verification (every 7 days)
- Protected routes with middleware

### Dashboard
- Overview statistics (total applications, interviews, offers, response rate)
- Application trends chart
- Status distribution pie chart
- Upcoming interviews widget
- Pending reminders widget
- Recent activity timeline

### Applications Management
- Create, read, update, delete job applications
- Filter applications by status, company, and date
- Track application details:
  - Company name and position
  - Application status (Applied, Interview, Offer, Rejected, etc.)
  - Salary information (expected/offered)
  - Job posting URL and location
  - Notes and documents
- Tag applications for organization
- Export applications to CSV/JSON

### Interviews
- Schedule and track interviews
- Multiple interview types (Phone Screen, Technical, Behavioral, On-site, Final)
- Interview status tracking (Scheduled, Completed, Cancelled, Rescheduled)
- Meeting links and location support
- Preparation and post-interview notes
- Calendar view of upcoming interviews

### Contacts
- Manage recruiters and hiring managers
- Store contact information (email, phone, LinkedIn)
- Associate contacts with companies
- Track interaction history

### Reminders
- Set follow-up reminders for applications
- Due date tracking with overdue alerts
- Mark reminders as completed
- Link reminders to specific applications

### Email Templates
- Create reusable email templates
- Variable placeholders (company, position, contact name, date)
- Categorize templates (Follow-up, Thank You, etc.)
- One-click copy to clipboard

### Salary Tracking
- Track expected and offered salaries
- Compare compensation across applications
- Salary analytics and insights

### Activity Logs
- Automatic activity tracking
- Timeline of all application changes
- Status change history

### Security
- CSRF protection with HMAC-signed tokens
- Rate limiting
- Secure OTP generation using Node.js crypto
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Row Level Security (RLS) on Supabase
- Secure PDF viewer for documents

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (for documents)
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Radix UI primitives
- **Charts**: Recharts
- **Form Handling**: React Hook Form + Zod validation
- **Icons**: Lucide React
- **Notifications**: Sonner (toast notifications)

## Project Structure

```
web/
├── app/
│   ├── (auth)/                    # Auth pages
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── verify-email/
│   ├── (dashboard)/               # Protected dashboard pages
│   │   ├── dashboard/
│   │   ├── applications/
│   │   │   ├── [id]/
│   │   │   │   └── edit/
│   │   │   └── new/
│   │   ├── interviews/
│   │   ├── reminders/
│   │   ├── contacts/
│   │   ├── templates/
│   │   └── salary/
│   ├── api/
│   │   ├── export/
│   │   ├── documents/
│   │   └── contact/
│   ├── auth/                      # Auth callbacks
│   ├── privacy/
│   ├── terms/
│   └── contact/
├── components/
│   ├── ui/                        # Base UI components
│   ├── applications/              # Application components
│   ├── dashboard/                 # Dashboard widgets
│   ├── interviews/                # Interview components
│   ├── reminders/                 # Reminder components
│   ├── contacts/                  # Contact components
│   ├── templates/                 # Email template components
│   ├── tags/                      # Tag components
│   ├── activity/                  # Activity timeline
│   └── layout/                    # Layout components
├── services/                      # API service functions
│   ├── applications.ts
│   ├── interviews.ts
│   ├── reminders.ts
│   ├── contacts.ts
│   ├── email-templates.ts
│   ├── tags.ts
│   ├── analytics.ts
│   ├── activity-logs.ts
│   ├── salary.ts
│   └── export.ts
├── lib/
│   ├── proxy/                     # Middleware logic
│   ├── security/                  # Security utilities
│   ├── supabase/                  # Supabase clients
│   └── validations/               # Zod schemas
├── hooks/                         # Custom React hooks
├── types/                         # TypeScript types
└── supabase/
    └── migrations/                # Database migrations
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm/yarn/pnpm/bun
- Supabase account

### Environment Variables

Create a `.env.local` file in the `web/` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
CSRF_SECRET=your_csrf_secret
```

### Database Setup

1. Create a new Supabase project
2. Run the migrations in order from `supabase/migrations/`

### Installation

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Deployment

Deploy to Vercel or any platform that supports Next.js:

```bash
npm run build
```

## License

Private - All rights reserved
