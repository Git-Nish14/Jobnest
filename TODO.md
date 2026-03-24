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
  - **Required**: Enable Google and GitHub providers in Supabase dashboard → Authentication → Providers

- [x] **Session sync across tabs**
  - `AuthSync` component in dashboard layout; `SIGNED_OUT` event redirects all open tabs to `/login`

- [x] **Stay signed in / session-only sessions**
  - "Stay signed in" checkbox on login (default: checked)
  - `sb_rm=0` (7-day) → `AuthSync` detects new browser session and signs out automatically
  - `sb_rm=1` (30-day) → stays signed in; OAuth always sets `sb_rm=1`

- [ ] **Auto-redirect authenticated users from auth pages → dashboard**
  - If a valid Supabase session cookie is already present when visiting `/login`, `/signup`, or `/forgot-password`, redirect straight to `/dashboard` without showing the form
  - Currently the proxy redirects `/login` → `/dashboard` for authenticated users, but only after the Supabase session is refreshed server-side — verify this works reliably for all auth providers (email + OAuth) and that the `sb_rm` cookie does not interfere
  - Edge case: if `sb_rm=0` and it's a new browser session, `AuthSync` will sign the user out anyway — ensure the redirect in `proxy.ts` also checks this condition to avoid a redirect loop (redirect to dashboard → AuthSync signs out → redirect to login → repeat)
  - Test: open `/login` while logged in with "Stay signed in" checked → should land on `/dashboard` instantly

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
- [ ] **Smart context trimming** — estimate token count; summarise if over ~100K tokens

---

## 🎨 Design — STITCH Implementation

The file `STITCH_DESIGN_PROMPT.txt` in the repo root contains the complete design spec. Key items to implement:

- [ ] **Status badge colours** — verify all badges match STITCH spec exactly:
  - Applied: `#EFF6FF`/`#1D4ED8`, Phone Screen: `#F5F3FF`/`#7C3AED`, Interview: `#FFFBEB`/`#B45309`
  - Offer: `#F0FDF4`/`#15803D`, Rejected: `#FFF1F2`/`#BE123C`, Withdrawn: `#F8FAFC`/`#475569`, Ghosted: `#FFF7ED`/`#C2410C`

- [ ] **Dashboard page header** — add `H1 "Dashboard"` + subtext + restore "+ New Application" button in content area (not navbar; user removed navbar button intentionally)

- [ ] **Applications list filter bar** — search input with magnifier icon, Status/Location/Date Range/Sort dropdowns, all 36px height

- [ ] **Application card hover state** — `translateY(-2px)` + shadow lift + border darkens, 150ms ease

- [ ] **Landing page** — implement STITCH spec: hero with gradient text, stats section, how-it-works steps, features grid, social proof card, CTA section

- [ ] **NESTAi sidebar** — match STITCH: pinned label, recent label, session row hover, inline confirm for delete (✓ done), skeleton loading

- [ ] **OTP boxes** — ensure 48×48px on all pages (login/signup/forgot-password/profile)

- [ ] **Empty states** — standardise all empty states: dashed border card, 56×56px icon box, heading + description + CTA

- [ ] **Password strength meter** on signup — 3 bars, colour-coded (gray → red → amber → green)

- [ ] **Card hover animation** — `translateY(-2px)` + shadow increase, 150ms ease, across applications/contacts/templates list

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

- [ ] **Terms of Service page upgrade** (`/terms`)
  - Current page has placeholder text — needs full content:
    - Acceptance of terms
    - Permitted use (personal job search tracking, not commercial resale)
    - Account responsibility (user is responsible for their credentials)
    - Content ownership (user retains ownership of their data)
    - Service availability (no uptime guarantee for free tier)
    - Termination (account deletion flow, 30-day grace)
    - Limitation of liability
    - Governing law

- [ ] **Cookie Policy page** (`/cookies`) — new page
  - List every cookie set by the app with: name, purpose, type (essential/preference), duration
    - `sb-<ref>-auth-token` — Supabase session (essential, 1h / 7d refresh)
    - `sb_rm` — remember-me preference (preference, 7d or 30d)
    - Any future analytics cookies
  - Link to this page from the cookie consent banner and Privacy Policy

---

## 💬 Error Messages & User-Facing Copy

- [ ] **Audit all user-facing error messages for accuracy and clarity**
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
- [ ] **End-to-end tests** — auth flow, application CRUD, NESTAi session + message flow

---

## 🐛 Known Issues

- [ ] Document parse cache is in-memory — lost on server restart
- [ ] Rate limiter is in-memory — resets on Vercel cold starts (see Security section)
- [ ] `pdf-parse` v1 + Turbopack may cause issues with PDF text extraction in dev — works in production build

---

*Last updated: March 2026*
