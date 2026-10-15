# Jobnest

A job search workspace for tracking applications, managing documents, preparing for interviews, and getting support from NESTAi.

[Website](https://jobnest.nishpatel.dev) · [Repository](https://github.com/Git-Nish14/Jobnest) · Built by [Nish Patel](https://nishpatel.dev)

## Features

- **Application tracking:** manage your pipeline, import job postings, search application content, and export records.
- **Document management:** organize resumes and cover letters, preview PDF and DOCX files, annotate PDFs, compare versions, and share expiring links.
- **NESTAi:** get resume feedback, interview preparation, email drafts, and conversational support informed by your job search. Includes file attachments, image input, daily token usage, and Pro semantic retrieval.
- **Resume assessment:** compare a resume with a job description using the ATS scanner and review resume audit suggestions.
- **Interview preparation:** manage interviews, coding practice, system design topics, behavioral answers, and mock interviews.
- **Reminders and notifications:** receive live badge updates, manage reminders, and enable browser push alerts for overdue tasks.
- **Networking and compensation:** manage contacts, outreach statuses, referrals, and coffee chats; compare compensation and export offer comparisons.
- **Developer portfolios:** publish selected projects, skills, and GitHub repositories.

The interface supports dark mode, responsive layouts, and installation as a progressive web app. The [ChatGPT integration guide](docs/CHATGPT_PLUGIN_SETUP.md) explains how to connect Jobnest for checking and saving job applications.

## Technology

| Area | Tools |
| --- | --- |
| Application | Next.js App Router, React, TypeScript |
| Interface | Tailwind CSS, Radix UI, React Hook Form, Zod |
| Data and authentication | Supabase PostgreSQL, Auth, Storage, Realtime, pgvector |
| AI | OpenAI for NESTAi chat and embeddings; configurable providers for resume scanning |
| Documents | Mammoth, PDF.js, pdf-parse, React PDF |
| Email and push | Nodemailer, Web Push |
| Billing and monitoring | Stripe, Sentry |
| Testing | Vitest, Playwright |

## Local development

### Prerequisites

- Node.js **24** and npm, matching the current dependency requirements.
- A Supabase project with database, authentication, and storage configured.
- SMTP credentials for the application's email verification flow and transactional mail.
- An OpenAI API key to use NESTAi chat and semantic retrieval.

### 1. Install dependencies

```bash
git clone https://github.com/Git-Nish14/Jobnest.git
cd Jobnest/web
npm ci
```

Application commands run from `web/`. Use the committed lockfile to reproduce the dependency installation.

### 2. Configure the environment

Create `web/.env.local` with the following settings and replace the placeholder credentials:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CSRF_SECRET=replace-with-a-generated-secret
CRON_SECRET=replace-with-a-different-generated-secret

SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
CONTACT_EMAIL=contact@example.com

# Required for NESTAi chat and semantic retrieval.
OPENAI_API_KEY=your-openai-api-key
```

Generate independent values for `CSRF_SECRET` and `CRON_SECRET` by running this command twice:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep `.env.local` and server credentials out of version control; the Supabase service-role key must remain server-only. Omit optional service keys until you configure those integrations.

Configure these integrations as needed:

| Integration | Configuration |
| --- | --- |
| Additional AI providers | `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`; Groq is also used by conversation-memory extraction |
| Stripe billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`; optionally `STRIPE_PRO_ANNUAL_PRICE_ID` |
| Persistent rate limiting and caching | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Virus scanning | `CLOUDMERSIVE_API_KEY` for server-side scanning paths |
| GitHub portfolio connection | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`; optionally `GITHUB_STATE_SECRET` |
| Push notifications | `VAPID_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| Sentry | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`; deployment/source-map settings as required |

Add these settings to `.env.local` when enabling the corresponding features.

### 3. Initialize Supabase

Apply the SQL files in [supabase/migrations](supabase/migrations) in filename order, starting with `20240101000000_initial_schema.sql`. The migrations define the application tables, access policies, storage setup, and supporting functions.

Include `20240101000055_notification_bell_realtime.sql` for notification publication and replica identity. Configure Supabase Auth site and redirect URLs for the local application, and enable any social sign-in providers you intend to use.

### 4. Run the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To test a production build locally:

```bash
npm run build
npm run start
```

The build downloads the configured Google Fonts, so font-host access is required during compilation.

## Development commands

Run from `web/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run unit and mocked flow tests |
| `npm run test:coverage` | Run tests with the configured coverage gate |
| `npm run test:e2e` | Run the general Playwright suite |
| `npm run test:e2e:features` | Run live notification and DOCX browser checks |
| `npm run test:mobile` | Run isolated browser UI regressions |
| `npm run test:mobile:webkit` | Run the selected WebKit browser regressions |

## Testing

### Unit and flow tests

```bash
npm test
npm run test:coverage
```

These tests mock external services. They do not verify deployed credentials, database migrations, or live provider behavior.

### General browser tests

```bash
npx playwright install chromium
npm run test:e2e
```

The general [Playwright configuration](web/playwright.config.ts) starts a local development server by default. Set `PLAYWRIGHT_BASE_URL` in the runner's environment to target a running deployment. Supply `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` through the shell or CI environment for authenticated suites; many skip when credentials are absent. The general configuration does not load `.env.local` into the test runner.

Use dedicated accounts and a test Supabase project for browser suites that create or delete records.

### Live notification and DOCX checks

Configure the Supabase URL, anon key, and service-role key in `web/.env.local`, apply migration 055, then run:

```bash
node scripts/prepare-feature-e2e.mjs
npm run test:e2e:features
```

The setup script creates a confirmed account and stores its credentials in ignored `.env.local`; later runs reuse them. An existing dedicated account can also be configured with `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`.

This suite loads `.env.local`, authenticates through Supabase session cookies without sending login emails, and runs on desktop Chrome and Pixel 5 emulation. It checks notification delivery over WebSocket, badge changes without reload, read-state reconciliation, a real DOCX upload and formatted preview, ownership rejection, and preview close/reopen behavior. Tests attempt to remove their own rows and uploaded files in cleanup; the account is retained.

The default target is `http://localhost:3000`. Set `E2E_BASE_URL` to use a staging deployment connected to the same Supabase project. This variable is separate from `PLAYWRIGHT_BASE_URL`. Missing feature-test credentials produce an error rather than a skipped test.

On Windows, the feature and isolated mobile configurations use installed Chrome when available. Otherwise, install Chromium. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to select a different executable for those configurations.

### Isolated UI regressions

```bash
npm run test:mobile
npm run test:mobile -- notification-docx.spec.ts
```

These tests render application components with mocked routing, API responses, and Supabase behavior. They cover mobile gestures, forms, dialogs, stale notification responses, DOCX error recovery, and iframe restrictions without writing to a live database.

For WebKit, install its browser first with `npx playwright install webkit`. See the [browser suite guide](web/tests/mobile-browser/README.md) for supported cases and production CSS checks.

## Repository layout

```text
web/
  app/          Pages, layouts, and API routes
  components/   UI and feature components
  lib/          Integrations, utilities, and security helpers
  services/     Data access
  tests/        Unit, flow, E2E, and isolated browser tests
  public/       Static assets, manifest, and service worker
  proxy.ts      Authentication, redirects, and security headers
supabase/
  migrations/   Database schema and access-policy changes
docs/           Integration setup guides
```

## Deployment

For Vercel, import the repository, select `web` as the root directory, use Node.js 24, and configure production environment variables. Apply the database migrations to the connected Supabase project and configure production Auth redirect URLs.

For billing, configure Stripe's webhook endpoint at `/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`. Configure GitHub OAuth separately if portfolio repository synchronization is enabled.

Scheduled jobs are defined in [web/vercel.json](web/vercel.json) and authenticate with `CRON_SECRET`. Check that the deployment supports each configured schedule. The weekly digest currently runs on **Saturday at 21:00 UTC**; delivery at each user's local Saturday evening is not enabled.

The existing [CI workflow](.github/workflows/ci.yml) runs type, lint, unit, coverage, and build checks. Its general E2E job runs only when the repository variable `PLAYWRIGHT_BASE_URL` is set. CI still specifies Node.js 20 and needs alignment with the documented runtime.

## Security and contributions

Data access uses Supabase row-level security, authenticated API handlers, and ownership checks. DOCX previews use a restricted iframe. Rate limiting, origin checks, and file validation are implemented in the relevant API paths; optional integrations require their own configuration.

Report vulnerabilities privately through the repository's GitHub security reporting tools. For substantial product changes, open an issue to discuss scope before implementation.

Before opening a pull request, run `npm test`, `npm run lint`, and `npm run typecheck` from `web/`. Include validation appropriate to the change and describe its user-visible behavior.
