# JobNest Web Application

Next.js 16 web application for the JobNest job tracking platform.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Environment Setup

Copy `.env.example` to `.env.local` and fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
CSRF_SECRET=
```

## Database Migrations

Run these SQL files in your Supabase SQL Editor in order:

1. `supabase/migrations/001_initial_setup.sql` - Database schema
2. `supabase/migrations/002_storage_setup.sql` - Storage configuration

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router pages |
| `components/` | React components |
| `lib/` | Utilities, clients, security |
| `supabase/` | Database migrations |

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start development server with Turbopack |
| `build` | Build for production |
| `start` | Start production server |
| `lint` | Run ESLint |
