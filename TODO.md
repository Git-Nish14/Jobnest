# Jobnest — TODO & Roadmap

Tracked next steps ordered roughly by priority. Check off items as they ship.

---

## 🚨 Before Next Deploy — Run These First

- [ ] **Run Supabase migrations 7, 8 + 9**
  - Open Supabase dashboard → SQL editor
  - Run `supabase/migrations/20240101000007_pending_deletions_improvements.sql` — fixes UNIQUE constraint, adds `delete_account` OTP purpose
  - Run `supabase/migrations/20240101000008_chat_pin.sql` — adds `is_pinned` to `chat_sessions`
  - Run `supabase/migrations/20240101000009_chat_message_metadata.sql` — adds `metadata` JSONB to `chat_messages` (for file attachment cards)

- [ ] **Update `web/.env.local`**
  - Add `NEXT_PUBLIC_APP_URL=https://jobnest.nishpatel.dev`
  - Add `CRON_SECRET=<generate: openssl rand -hex 32>`
  - Confirm `NEXT_PUBLIC_SITE_URL=https://jobnest.nishpatel.dev`

- [ ] **Update Vercel environment variables** (Settings → Environment Variables)
  - `NEXT_PUBLIC_APP_URL=https://jobnest.nishpatel.dev`
  - `NEXT_PUBLIC_SITE_URL=https://jobnest.nishpatel.dev`
  - `CRON_SECRET=<same value as .env.local>`
  - Redeploy after adding

---

## 🔐 Auth

- [x] **OAuth — Google & GitHub sign-in/sign-up**
  - Buttons on login and signup pages (inline SVG icons, no extra deps)
  - `supabase.auth.signInWithOAuth()` client-side; `/auth/callback` exchanges code + sets `sb_rm=1` cookie
  - OAuth on signup page is **blocked** until user has checked both the age (18+) and terms checkboxes
  - **Required**: Enable Google and GitHub providers in Supabase dashboard → Authentication → Providers

- [x] **Age verification + Terms acceptance on signup**
  - Two required checkboxes added to signup form before "Create Account" can be submitted:
    - "I am 18 years of age or older" (required; blocks both email and OAuth signup)
    - "I accept the Terms of Service and Privacy Policy" (required; blocks both email and OAuth signup)
  - Enforced via Zod `signupFormSchema` (`ageConfirmed: z.literal(true)`, `termsAccepted: z.literal(true)`)
  - OAuth buttons show an error and abort if either checkbox is unchecked
  - Terms of Service page updated: Section 2 "Age Requirement" added, Section 1 updated to mention OAuth, new NESTAi and Stripe sections added

- [x] **Session sync across tabs**
  - `AuthSync` component in dashboard layout; `SIGNED_OUT` event redirects all open tabs to `/login`

- [x] **Stay signed in for 30 days / session-only sessions**
  - "Stay signed in for 30 days" checkbox on login (default: checked)
  - `rememberMe=true`  → `sb_rm=1` cookie, 30-day Max-Age
  - `rememberMe=false` → `sb_rm=0` cookie, 7-day Max-Age; `AuthSync` detects new browser session and signs out automatically
  - OAuth always sets `sb_rm=1` (30-day persistent)

- [x] **Auto-redirect authenticated users from auth pages → dashboard**
  - `proxy.ts`: extended auth page set to `/login`, `/signup`, `/forgot-password`
  - Redirect only when `sb_rm !== "0"` — if user opted out of persistence, let them reach login without redirect to avoid AuthSync loop

---

## 👤 Profile Page

- [x] **Full profile page** — two-column layout (sticky sidebar left, settings right)
  - Sidebar: avatar, name, email, plan badge, joined date, password/auth stats, quick nav
  - Display name, NESTAi Context, Notifications (toggle switches), Change/Set Password, Danger Zone
  - Modern card design with coloured icon badges per section

- [x] **Password change → force sign-out**
  - After successful password change: 5-second countdown with "Signing out of all devices" panel
  - "Sign in now" button skips countdown
  - `signOut()` + redirect to `/login` on countdown expiry

- [x] **OAuth users can set a password**
  - Profile detects `hasPassword` from `user.identities`
  - Card shows "Set Password" flow (no current password needed, OTP directly)
  - After setting: card upgrades to "Change Password" mode + `hasPw` flips to true

- [x] **Forgot current password in profile**
  - "Forgot password?" link below current password field
  - Sends OTP directly (bypasses current-password check)
  - OTP must verify before new password fields appear

- [x] **OTP gating — password fields only shown after correct OTP**
  - `verify-change-otp` API pre-verifies OTP without consuming it
  - Continue button calls the API; only advances on success
  - Applies to all OTP flows checked: login ✓, signup ✓, forgot-password ✓, profile change-pw ✓, delete-account ✓

- [x] **Soft-delete / account grace period**
  - 30-day grace, 7-day reminders, 24h final warning, OTP-confirmed, IP + reason recorded
  - Daily Vercel Cron job; dashboard banner + inline cancel

- [x] **NESTAi AI context + Notification preferences**

---

## 🤖 NESTAi — AI Assistant

- [x] **Streaming responses with stop button** — `stream: true`, `AbortController`, partial content preserved
- [x] **Message history 10 → 100**
- [x] **Pin chats** — migration 8, pinned section at top of sidebar, optimistic update
- [x] **Confirm before delete** — inline confirm in dropdown
- [x] **File attachments** — non-blocking, PDF/DOCX/TXT, type-coloured card in message, saved to metadata (migration 9)
- [x] **Markdown rendering** — headers, bold, italic, inline code, fenced code blocks (dark), lists, blockquotes, streaming cursor
- [x] **PDF validation fix** — file content sent as separate `fileContent` + `fileName` fields, not embedded in `question` (bypasses 2000-char limit)
- [x] **File attachment card persists on session reload** — metadata JSONB on chat_messages
- [x] **User About Me injected into system prompt**
- [x] **Suggested follow-up questions** — model appends `FOLLOW_UPS:` marker; client parses and shows as tappable chips
- [x] **Smart context trimming** — 4-step progressive trim: history→20, docs→1000 chars, docs omitted+activity→20, hard truncate. 124 500-token budget.

---

## 🎨 Design — Intellectual Atelier (all done ✓)

> Full Intellectual Atelier design system shipped across every page — auth, dashboard, and public pages. Warm parchment palette, Newsreader + Manrope typography, pill buttons, tonal card layering, and atelier status badges are now consistent site-wide.

### Auth Pages (done ✓)
- [x] Login — Atelier card, OAuth grid, eye toggle, stay-signed-in, OTP step
- [x] Signup — Atelier card, full-width OAuth stack, strength meter, eye toggles, must-match
- [x] Forgot-password — 4-step Atelier flow (email → OTP → new password → success)

### Dashboard & Public Pages (done ✓)
- [x] **Landing page (`/`)** — hero gradient text, stats strip, how-it-works steps, features grid, social proof card, CTA
- [x] **Dashboard overview (`/dashboard`)** — Newsreader large title, stat cards, bar chart, status pie chart, recent apps, tasks panel — all live data
- [x] **Applications list (`/applications`)** — `db-filter-bar` pill filters, search, sort dropdown, `db-app-card` with left status accent bar, status badges
- [x] **Application detail (`/applications/[id]`)** — hero section, 2-col grid, activity timeline, interview list, document viewer, all live data
- [x] **Interviews (`/interviews`)** — upcoming + past sections, type/round/status badges, Join button links to meeting URL
- [x] **Reminders (`/reminders`)** — overdue (red accent), upcoming, completed-collapsed; mark-complete working
- [x] **Contacts (`/contacts`)** — warm card grid, add-contact dialog, save/delete wired
- [x] **Email Templates (`/templates`)** — variable pill badges, atelier gallery modal with category pills, copy-to-clipboard working
- [x] **Salary (`/salary`)** — stat grid, offer comparison table, benefits pills, all columns live
- [x] **NESTAi (`/nestai`)** — sidebar pinned/recent labels, skeleton loading, rate-limit dots, suggested chips, streaming cursor, file attachment states
- [x] **Profile (`/profile`)** — sidebar avatar/stats, section cards, OTP gating and deletion flow intact

### Base UI components (done ✓)
- [x] **CSS variables** — `--primary` + `--ring` → terracotta `#99462a`; `--accent`/`--muted` → warm parchment (cascades automatically)
- [x] **Button** — `rounded-full` pill, `font-semibold`, terracotta default + outline variants
- [x] **Input / Textarea** — `bg-[#f4f3f1]` warm surface, `border-[#dbc1b9]/50`, terracotta focus ring
- [x] **Select** — matching warm trigger + `rounded-xl` dropdown
- [x] **Dialog** — `backdrop-blur-sm` overlay, `bg-[#faf9f7] rounded-2xl`, atelier close button
- [x] **DropdownMenu** — `rounded-xl`, `bg-[#faf9f7]`
- [x] **Label** — `text-[#55433d] font-semibold`
- [x] **`db-headline`** class added — Newsreader font for all section h2/h3 headings

### Cross-cutting (done ✓)
- [x] **Empty states** — icon box + heading + description + CTA standardised on all list pages
- [x] **Card hover** — shadow lift on `db-app-card` and `db-content-card`, 200ms ease
- [x] **Status badge colours** — atelier tonal tokens per status (Interview, Phone Screen, Applied, Offer, Rejected, Withdrawn) via `db-status-badge` + `db-status-*` classes
- [x] **Toast messages** — specific success/error messages verified across all flows
- [x] **Responsive** — all pages verified on mobile; filter bar stacks vertically, cards stack, filter pills scroll horizontally
- [x] **Password strength meter** on signup — 3 bars, colour-coded

---

## 📱 Responsive Design

- [ ] **Mobile navigation** — bottom tab bar for most-used sections (Overview, Applications, Interviews, NESTAi)
- [ ] **NESTAi sidebar on mobile** — full-screen drawer, swipe-to-open
- [ ] **Application detail mobile layout** — stack two-column vertically, sticky action buttons
- [ ] **Forms — mobile keyboard handling** — inputs not obscured by on-screen keyboard
- [ ] **Table / list views** — horizontal scroll on small screens (interviews, salary, templates)

---

## ⚖️ Legal & Compliance

- [ ] **Cookie consent banner (GDPR / PECR)**
  - Show a consent banner on first visit for non-authenticated users (and any page served to EU visitors)
  - Options: "Accept all" / "Manage preferences" / "Reject non-essential"
  - Essential cookies only (Supabase session, `sb_rm` remember-me) — no analytics cookies currently, but consent should be captured before any are added
  - Consent choice stored in `localStorage` (e.g. `jobnest_cookie_consent`) and checked on every page load
  - Banner should not appear on subsequent visits once consent is given
  - Link to Cookie Policy and Privacy Policy from the banner
  - Banner must not block content (non-modal, bottom-of-page strip or corner card)

- [ ] **Privacy Policy page upgrade** (`/privacy`)
  - Current page has placeholder/minimal text — needs full legal content:
    - What data is collected (email, name, application data, IP address on account deletion, cookies)
    - How data is stored (Supabase, EU/US data residency)
    - Data retention (30-day grace period on deletion, then permanent purge)
    - User rights (access, rectification, erasure — via profile page delete flow)
    - Cookie usage (session cookies, `sb_rm` preference cookie)
    - Third-party services (Supabase, Groq AI, Vercel, your SMTP provider)
    - Contact information for data requests
  - Add "Last updated" date at the top

- [x] **Terms of Service page upgrade** (`/terms`)
  - Updated with full content (14 sections):
    - 1. Acceptance of terms (mentions OAuth)
    - 2. **Age requirement** — 18+ enforced at registration (email + OAuth); accounts under 18 may be terminated
    - 3. Description of service (NESTAi, Pro plan)
    - 4. User accounts (age requirement listed)
    - 5. Acceptable use (added: no commercial resale)
    - 6. User content
    - 7. AI features / NESTAi disclaimer
    - 8. Service availability
    - 9. Disclaimer of warranties
    - 10. Limitation of liability
    - 11. Account termination (30-day grace period described)
    - 12. Changes to terms
    - 13. Governing law
    - 14. Contact

- [ ] **Cookie Policy page** (`/cookies`) — new page
  - List every cookie set by the app with: name, purpose, type (essential/preference), duration
    - `sb-<ref>-auth-token` — Supabase session (essential, 1h / 7d refresh)
    - `sb_rm` — remember-me preference (preference, 7d or 30d)
    - Any future analytics cookies
  - Link to this page from the cookie consent banner and Privacy Policy

---

## 💬 Error Messages & User-Facing Copy

- [x] **Audit all user-facing error messages for accuracy and clarity**
  - Every API `ApiError` message that reaches the client should be:
    - **Accurate** — describes the actual problem (not a generic "Something went wrong")
    - **Actionable** — tells the user what to do next ("Try again", "Check your email", "Wait 60 seconds")
    - **Non-technical** — no stack traces, no internal field names, no HTTP status codes shown to users
  - Specific areas to review:
    - OTP errors: "Invalid verification code. 2 attempts remaining." — good; ensure attempt count is always correct
    - Rate limit errors: show exact wait time in seconds (already done for NESTAi; verify auth endpoints too)
    - File upload errors: "File exceeds 5 MB limit" vs "Could not extract text" — ensure distinction is clear
    - Password change: distinguish "wrong current password" from "OTP expired" from "passwords don't match"
    - Delete account: if already pending deletion, show the scheduled date not just "conflict"
    - OAuth errors: if OAuth callback fails, `/auth/auth-error` page should show a helpful message and a retry button — not a blank error
    - Network/fetch errors: `fetchWithRetry` exhausts retries — show "Connection issue, please check your internet" not a raw error
  - Form validation messages (Zod): ensure all `.min()`, `.max()`, `.regex()` messages are user-friendly and in plain English
  - Success messages: verify they are specific ("Password changed" not just "Done") and disappear after 3s consistently
  - Empty states: all empty state headings and descriptions should be encouraging, not just "No data"

---

## 📊 Analytics & Export

- [ ] **Richer dashboard analytics** — avg time to first response, interview-to-offer rate, most common rejection stage
- [ ] **Export improvements** — salary + tags in CSV/JSON, PDF summary per application

---

## 🔔 Notifications

- [ ] **In-app notification bell** — badge count for overdue reminders + upcoming interviews within 24h
- [ ] **Email digest** — actual email sending for weekly digest and overdue reminders (prefs stored, sending not built)

---

## 🔒 Security

- [x] **Next.js upgraded 16.1.6 → 16.2.1** — fixes HTTP request smuggling (GHSA-ggv3-7p47-pfv8), CSRF bypass (GHSA-mq59-m269-xvcx), DoS (GHSA-h27x-g6w4-24gq), dev HMR CSRF (GHSA-jcc7-9wpm-mj36)
- [x] **flatted prototype pollution fixed** — `npm audit fix` (GHSA-rf6f-7fwh-wjgh)
- [x] **CRON_SECRET guard fail-closed** — previously skipped auth entirely if `CRON_SECRET` env var was not set; now always enforces (endpoint returns 401 if secret missing or mismatched)
- [ ] **Redis-backed rate limiting** — in-memory rate limiter resets on every Vercel cold start; multiple instances don't share state → attacker can abuse across instances. Replace with Upstash Redis or Vercel KV
- [ ] **`pdf-parse` upgrade 1.1.1 → 2.x** — current version has Turbopack issues; 2.x is a breaking API change, needs testing
- [ ] **Environment variable validation on startup** — throw clear error at boot if `GROQ_API_KEY`, `SMTP_HOST`, `CRON_SECRET` etc. are missing (instead of silent failures)
- [ ] **`sb_rm` cookie XSS exposure** — the "remember me" companion cookie is JS-readable (intentional for `AuthSync`) but is XSS-accessible. Mitigated by no identified XSS vectors, but worth revisiting if CSP is ever loosened
- [ ] **CSRF on profile API routes** — currently relies on Supabase session cookie with `SameSite=Lax` for CSRF protection. Acceptable but should add explicit CSRF tokens for defence in depth

---

## ⚙️ Infrastructure & DX

- [x] **Migrate `middleware.ts` → Next.js 16 `proxy` convention** — `web/proxy.ts`
- [x] **Dependencies upgraded** — `next@16.2.1`, `@supabase/supabase-js@2.100.0`, `tailwindcss@4.2.2`, `nodemailer@8.0.3`, `react-hook-form@7.72.0`, `react@19.2.4`, `react-dom@19.2.4`, `geist` installed
- [ ] **Major version upgrades (evaluate carefully)**:
  - `lucide-react` 0.577 → 1.0.1 (major — check for breaking icon name changes before upgrading)
  - `typescript` 5.9 → 6.0 (major — breaking strict changes; test thoroughly)
  - `eslint` 9 → 10 (major — config format may change)
  - `@types/node` 20 → 25 (major)
  - `pdf-parse` 1.x → 2.x (major API change)
- [ ] **Move document parse cache to Redis** — in-memory cache lost on cold starts
- [ ] **Error monitoring** — integrate Sentry for server-side and client-side error tracking
- [x] **Vitest tests — 261 tests, 24 files, 100% pass (no browser, fully automated)**
  - Unit tests: `tests/unit/` — lib utilities (incl. signupFormSchema age+terms), all API route handlers, proxy
  - E2E flow tests: `tests/flows/` — full user journeys (login incl. remember-me, signup incl. age/terms pre-conditions, forgot-password, change-password, delete+reactivate, NESTAi chat+upload)
  - No Playwright — all tests run via `npm test` in any CI/CD environment

---

## 🐛 Known Issues

- [ ] Document parse cache is in-memory — lost on server restart
- [ ] Rate limiter is in-memory — resets on Vercel cold starts (see Security section)
- [ ] `pdf-parse` v1 + Turbopack may cause issues with PDF text extraction in dev — works in production build

---

*Last updated: March 2026 — full Intellectual Atelier UI/UX revamp shipped site-wide (all dashboard + public pages), CSS variable system refactored to terracotta primary, all list/form/dialog components rewritten with atelier tokens, 253 tests all passing*
