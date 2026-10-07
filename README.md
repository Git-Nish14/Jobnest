# Jobnest

A workspace for your job search. Track applications, keep your documents organized, prepare for interviews, and get help from NESTAi along the way.

[Live demo](https://jobnest.nishpatel.dev) · Built by [Nish Patel](https://nishpatel.dev)

## What you can do

- **Track applications:** manage your pipeline, import job postings, search notes and descriptions, and export your records.
- **Manage documents:** store resumes and cover letters, preview PDFs and DOCX files, annotate PDFs, compare versions, and share files with expiring links.
- **Get AI support:** use NESTAi for resume feedback, interview questions, follow-up drafts, and conversations informed by your job search.
- **Check your resume:** compare it with a job description using the ATS scanner and review suggestions from the resume audit.
- **Prepare for interviews:** organize coding practice, system design topics, behavioral answers, and mock interviews.
- **Stay on schedule:** set reminders, receive live notification updates, and enable push alerts for overdue tasks.
- **Compare opportunities:** review compensation, compare offers, manage contacts and referrals, and explore your search analytics.
- **Share your work:** create a developer portfolio with projects and GitHub repositories.

Jobnest supports dark mode and mobile layouts. You can also save jobs from ChatGPT through the [ChatGPT integration](docs/CHATGPT_PLUGIN_SETUP.md).

## Built with

| Area | Tools |
| --- | --- |
| App | Next.js App Router, React, TypeScript |
| UI | Tailwind CSS, Radix UI, React Hook Form, Zod |
| Data and authentication | Supabase PostgreSQL, Auth, Storage, Realtime, pgvector |
| AI | OpenAI for NESTAi; multiple providers for resume scanning |
| Documents | Mammoth, PDF.js, pdf-parse |
| Email and push | Nodemailer, Web Push |
| Billing and monitoring | Stripe, Sentry |
| Tests | Vitest, Playwright |

## Run locally

You will need Node.js 20.9 or later, a Supabase project, and SMTP credentials for login emails. Configure an OpenAI key to use NESTAi. Billing, Redis rate limiting, virus scanning, and push notifications have separate configuration.

### 1. Install

```bash
git clone https://github.com/nish1patel/jobnest.git
cd jobnest/web
npm install
```

### 2. Configure your environment

Copy [web/.env.local.example](web/.env.local.example) to `web/.env.local` and fill in your values.

```bash
cp .env.local.example .env.local
```

On PowerShell, use `Copy-Item .env.local.example .env.local`.

Start with these settings:

| Setting | Variables |
| --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Local URLs | `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL`: `http://localhost:3000` |
| Security | `CSRF_SECRET`, `CRON_SECRET` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CONTACT_EMAIL` |
| NESTAi | `OPENAI_API_KEY` |

The example file includes settings for the other AI providers, Stripe, Redis, and Cloudmersive. Keep `.env.local` and service credentials out of version control.

### 3. Set up the database

Run the SQL files in [supabase/migrations](supabase/migrations) in filename order using the Supabase SQL Editor. They set up the schema, storage, access policies, and supporting features.

Include migration `20240101000055_notification_bell_realtime.sql` to enable live notification updates.

### 4. Start the app

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000) and create an account.

## Development commands

Run these commands from `web/`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Check code with ESLint |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run unit and flow tests |
| `npm run test:coverage` | Run tests with coverage checks |
| `npm run test:e2e` | Run the general Playwright suite |
| `npm run test:e2e:features` | Verify live notifications and DOCX previews |
| `npm run test:mobile` | Run browser UI regressions |

## Testing

Unit and flow tests use mocked services and run offline. The general Playwright suite starts a local Next.js server by default; set `PLAYWRIGHT_BASE_URL` to use a remote environment. Most authenticated tests require `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` and skip when they are missing.

### Live notification and DOCX tests

Use a dedicated test account and a Supabase project with migration 055 applied. With your Supabase URL, anon key, and service-role key configured in `.env.local`, run:

```bash
node scripts/prepare-feature-e2e.mjs
npm run test:e2e:features
```

The setup script creates a confirmed test account, saves its credentials in ignored `.env.local`, and reuses them on later runs. You can also configure an existing test account. The tests authenticate with Supabase session cookies without sending login emails.

This suite runs on desktop Chrome and Pixel 5 emulation. It verifies that a notification arrives over WebSocket and updates the badge without a reload, and that a real DOCX upload renders formatted content in the preview iframe. It also checks read-state updates, document ownership, and closing and reopening the preview. Each test removes its own records and files; the account remains available for future runs.

The feature suite defaults to `http://localhost:3000`. Set `E2E_BASE_URL` to use a staging build connected to the same Supabase project. This setting is separate from the general suite's `PLAYWRIGHT_BASE_URL`. Missing feature-test credentials cause a setup error rather than a skipped test.

On Windows, the suite uses installed Chrome when available. Otherwise, install Chromium with `npx playwright install chromium`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to choose a browser executable.

For isolated checks of stale badge responses, DOCX loading errors, and iframe security:

```bash
npm run test:mobile -- notification-docx.spec.ts
```

These browser tests simulate API and Realtime responses. See the [browser suite guide](web/tests/mobile-browser/README.md) for more detail.

## Project layout

```text
web/
  app/          Pages and API routes
  components/   UI components
  lib/          Shared utilities, integrations, and security helpers
  services/     Data access
  tests/        Unit, flow, E2E, and browser tests
  public/       Static assets and service worker
  proxy.ts      Authentication, redirects, and security headers
supabase/
  migrations/   Database setup and changes
```

## Deploy

To deploy on Vercel, import the repository, set the root directory to `web`, and configure the environment variables for your deployment. Apply the database migrations to the connected Supabase project before using the app.

Scheduled jobs are defined in [web/vercel.json](web/vercel.json). Configure `CRON_SECRET` for their authentication and check that your hosting plan supports the configured schedules.

## Security

Jobnest uses row-level security and ownership checks to protect user data. Uploads have type and content validation, DOCX previews run in a restricted iframe, and API routes use authentication, origin checks, and rate limits where required. Cloudmersive scanning is optional and requires its API key.

Please report vulnerabilities through a private GitHub Security Advisory.

## Contributing

Bug fixes, documentation improvements, and feature contributions are welcome. For a substantial change, open an issue first to discuss the approach.

Before opening a pull request, run `npm test`, `npm run lint`, and `npm run typecheck` from `web/`. Include relevant tests and explain what changed and why.
