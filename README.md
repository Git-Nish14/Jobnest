# JobNest - Job Application Tracker

A private platform to track job applications you have applied for. Built with Next.js 16, Supabase, and TypeScript.

## Features

### Authentication
- Email/Password authentication with Supabase Auth
- Email verification flow
- Password reset (forgot password / reset password)
- Periodic re-verification (every 7 days)
- Protected routes with middleware

### Dashboard
- Overview statistics (total applications, interviews, offers, etc.)
- Recent applications list
- Status breakdown visualization

### Applications Management
- Create, read, update, delete job applications
- Filter applications by status
- Track application details:
  - Company name
  - Position/Role
  - Application status (Applied, Interview, Offer, Rejected, etc.)
  - Notes and documents

### Security
- CSRF protection with HMAC-signed tokens
- Rate limiting
- Secure OTP generation using Node.js crypto
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Row Level Security (RLS) on Supabase

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (for documents)
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Radix UI primitives
- **Form Handling**: React Hook Form + Zod validation
- **Icons**: Lucide React

## Project Structure

```
web/
├── app/
│   ├── (auth)/                    # Auth pages (login, signup, etc.)
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── verify-email/
│   ├── (dashboard)/               # Protected dashboard pages
│   │   ├── dashboard/
│   │   └── applications/
│   │       ├── [id]/
│   │       │   └── edit/
│   │       └── new/
│   ├── auth/                      # Auth callbacks
│   ├── privacy/
│   ├── terms/
│   └── contact/
├── components/
│   ├── ui/                        # Base UI components
│   ├── applications/              # Application-specific components
│   ├── dashboard/                 # Dashboard components
│   ├── forms/                     # Form components
│   ├── layout/                    # Layout components (navbar)
│   └── common/                    # Shared components
├── lib/
│   ├── middleware/                # Middleware logic
│   │   └── auth.ts
│   ├── security/                  # Security utilities
│   │   ├── csrf.ts                # CSRF token generation/verification
│   │   ├── otp.ts                 # OTP generation using crypto
│   │   └── rate-limit.ts          # Rate limiting
│   ├── supabase/                  # Supabase clients
│   │   ├── client.ts              # Browser client
│   │   └── server.ts              # Server client
│   ├── utils/
│   │   └── storage.ts             # Storage utilities
│   └── validations/               # Zod schemas
├── supabase/
│   └── migrations/
│       ├── 001_initial_setup.sql  # Database schema
│       └── 002_storage_setup.sql  # Storage bucket & policies
└── middleware.ts                  # Next.js middleware (proxy)
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
2. Run the migrations in order:
   - `001_initial_setup.sql` - Creates tables and RLS policies
   - `002_storage_setup.sql` - Sets up document storage bucket

### Installation

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Security Features

### Middleware
The middleware is structured as a proxy pattern:
- `middleware.ts` - Thin proxy that delegates to auth module
- `lib/middleware/auth.ts` - Contains all authentication and security logic

### OTP Generation
Secure OTP generation using Node.js crypto module:
```typescript
import { generateOTP, verifyOTP } from "@/lib/security";

const { code, expiresAt } = generateOTP(); // 6-digit code, 10min expiry
const result = verifyOTP(userInput, storedCode, expiresAt);
```

### CSRF Protection
HMAC-signed CSRF tokens with timing-safe comparison:
```typescript
import { generateCSRFToken, verifyCSRFToken } from "@/lib/security";

const token = generateCSRFToken();
const isValid = verifyCSRFToken(token);
```

## Deployment

Deploy to Vercel or any platform that supports Next.js:

```bash
npm run build
```

## License

Private - All rights reserved
