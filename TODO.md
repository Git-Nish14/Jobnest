# Jobnest — TODO & Roadmap

Tracked next steps ordered roughly by priority. Check off items as they ship.

---

## ✅ Recently Shipped (April 2026)

- [x] **Full-text search in command palette** — `⌘K` searches applications via GIN-indexed `search_vector` tsvector column; `websearch_to_tsquery` supports quoted phrases and AND/OR; falls back to `ilike` on company/position when FTS migration is absent or returns nothing; rate-limited per user (30 req/min); results shown inline with keyboard navigation
- [x] **Developer Identity — Skills, Certifications, Education** — three-section UI on Profile page; full GET/POST/DELETE API routes with Zod validation, CSRF origin check, rate limiting, UUID-guarded deletes (400 on non-UUID, 404 on stale ID), RLS-enforced ownership; certification expiry/soon-expiring badges; GPA opt-in display on education; migrations 23 + 24
- [x] **Cursor-paginated application list** — keyset pagination on `(applied_date DESC, id DESC)`; server renders page 1; "Load more" appends pages client-side replicating all active filters (search, status, location, date range); kanban still loads all rows
- [x] **Nonce-based CSP** — per-request cryptographic nonce via Web Crypto API; `unsafe-eval` removed from `script-src`; `strict-dynamic` added; nonce fires on HTTPS and `x-forwarded-proto: https` (not just `NODE_ENV=production`)
- [x] **Security hardening** — fallback ilike queries in `/api/search` now include `.eq("user_id", user.id)` (was relying on RLS only); trufflehog GitHub Action pinned to `v3.95.2` (was `@main`); `--only-verified` removed so revoked secrets are caught; Dependabot schedule moved to 09:00 Monday Eastern time
- [x] **Test suite expanded** — 720 tests across 56 files (+106 tests, +5 files); new: search (14), skills (16), certifications (18), education (19), developer-identity flow (21), proxy CSP nonce (7)

---

## 🔥 Up Next (Priority)

- [x] **Unified Navbar & Footer across all pages**
  - Audited every page/layout file — found inline headers/footers on `/`, `/pricing`, and direct Navbar/Footer imports in `/contact`
  - Created `LandingHeader` (client component — auth-aware, pathname-based active state, mobile hamburger menu) and `LandingFooter` (server component — multi-column design matching the landing page)
  - Created `app/(public)/layout.tsx` route group — single canonical layout providing `LandingHeader` + `LandingFooter` for all 6 public pages
  - Moved `/`, `/pricing`, `/privacy`, `/terms`, `/contact`, `/cookies` into the `(public)` group; stripped per-page inline headers, footers, and font boilerplate (now provided once by the layout)
  - All existing functionality preserved: auth state, active nav indicators, mobile menu, scroll links on landing page sections, legal links including "Do Not Sell My Info" added to canonical footer
  - Added "Do Not Sell My Info" to `Footer.tsx` simple variant (CCPA compliance gap)
  - Fixed nested `<main>` semantic issue in landing page (layout provides `<main>`, page returns `<div>`)

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
  - `rememberMe=true` → `sb_rm=1` cookie, 30-day Max-Age
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

- [x] **Mobile navigation** — bottom tab bar for most-used sections (Overview, Applications, Interviews, NESTAi)
- [x] **NESTAi sidebar on mobile** — full-screen drawer, swipe-to-open
- [x] **Application detail mobile layout** — stack two-column vertically, sticky action buttons
- [x] **Forms — mobile keyboard handling** — viewport-fit=cover + safe-area insets applied
- [x] **Table / list views** — horizontal scroll on small screens (salary table, template/interview views)

---

## ⚖️ Legal & Compliance

- [x] **Cookie consent banner (GDPR / PECR)**
  - Non-modal bottom strip; "Accept all" / "Essential only" / "Manage preferences" (panel shows cookie breakdown)
  - Consent stored in `localStorage` under `jobnest_cookie_consent`; banner suppressed on subsequent visits
  - Links to Cookie Policy and Privacy Policy; added to root layout via `CookieBanner` component

- [x] **Privacy Policy page upgrade** (`/privacy`)
  - Full 15-section GDPR/CCPA-compliant policy: data collected, legal basis, third-party sub-processors (table), data residency, retention, GDPR rights, CCPA rights, security measures, international transfers, children's policy — "Last updated: 29 March 2026"

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

- [x] **Cookie Policy page** (`/cookies`) — new page
  - Full cookie-by-cookie table (name, purpose, type badge, duration, set-by); localStorage section; no-analytics statement; browser opt-out instructions; linked from banner, Privacy Policy, and both footer variants

---

## 💬 Error Messages & User-Facing Copy

- [x] **Audit all user-facing error messages for accuracy and clarity**
  - [x] **OAuth error page** — `/auth/auth-error` fully redesigned with Atelier design system; rich error-code mapping for all Supabase OAuth failure codes; "Try again with Google/GitHub" retry buttons shown when error is OAuth-specific; "Sign in with email instead" fallback; `auth/layout.tsx` created so the page inherits Atelier fonts + ThemeToggle
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

## 🗄️ Application Sanctuary — Document Storage

> Current: single `documents` bucket, PDF-only, 2 hard-coded slots (`resume_path` + `cover_letter_path`) per application, `upsert: true` destroys previous file, 1-hour signed URLs, no library.

### Document Types & Formats

- [x] **Expand allowed MIME types** — migration 17 adds DOCX, DOC, TXT, MD, PNG, JPEG; bucket limit raised to 10 MB; `storage.ts` validates client-side (MIME + size) before upload; server-side magic-byte validation added
- [x] **Additional document slots** — `application_documents` join table (migration 16) with `label`, `storage_path`, `mime_type`, `size_bytes`, `is_current`, `is_master`; `DocumentManager` replaces the two hard-coded slots; unlimited labels (≤80 chars)
- [x] **Custom document label** — free-text label field (≤80 chars) on upload; shown on document cards in `DocumentManager` and library page

### Document Versioning

- [x] **Version history** — each upload creates a new row with `is_current: true`; previous versions set to `false`; versioned path `{user_id}/{app_id}/{label}/{timestamp}_{filename}`; `DocumentCard` shows older versions in collapsible panel
- [x] **Version restore** — `POST /api/documents/[id]/restore` promotes any version to current; `RotateCcw` button per version in `DocumentManager`
- [x] **Version purge** — `POST /api/documents/[id]/purge-versions` deletes all non-current versions from Storage + DB; shows bytes freed in toast

### Master Document Library (`/documents`)

- [x] **Global document library page** — `/documents` route with search, type filter pills (All/PDF/DOCX/Image/Text), card grid; shows name, type badge, size, upload date; empty state with guided CTA
- [x] **Reusable document templates** — `is_master = true` flag on `application_documents`; master docs uploaded via `/documents` page or import-url; library path: `{user_id}/library/{label}/{timestamp}_{filename}`
- [x] **Storage quota widget** — progress bar on `/documents` page: `X MB used of 50 MB free · N documents` (sums `size_bytes` from `application_documents`)
- [x] **Orphan cleanup** — `POST /api/cron/orphan-cleanup` performs full orphan detection and deletion against Supabase Storage

### In-Browser Document Viewer

- [x] **Inline PDF/image viewer** — `PreviewDialog` in `DocumentManager` fetches blob via `/api/documents`, renders PDF in iframe and images in `<img>`; falls back to "Open in browser" for non-previewable types (DOCX, TXT)
- [x] **Text document preview** — non-previewable types (DOCX/TXT/MD) show "Open in browser" CTA; full text extraction already available in `document-parser.ts` for NESTAi + ATS scan
- [x] **Document annotation** — PDF.js canvas renderer (`pdfjs-dist` 5.x, CDN worker); sticky notes positioned via relative x/y/width percentages; draggable, 5 colour presets, debounced auto-save; `document_annotations` table (migration 30) with RLS; GET + POST `/api/documents/[id]/annotations`, PUT + DELETE `/api/documents/[id]/annotations/[annId]`; verifyOrigin on all 3 mutation handlers; `AnnotationDialog.tsx` opens from DocumentCard (PDF only) + DocPreviewDialog shortcut button

### Access & Sharing

- [x] **Extend signed URL TTL** — 24-hour TTL (was 1 hour); `GET /api/documents/refresh-url?document_id=` refreshes on-demand; `getSignedUrls()` batch helper added to `storage.ts`
- [x] **Shareable document link** — `POST /api/documents/share` creates time-limited public link (1d/7d/30d); 32-byte random token; `GET /api/documents/shared/[token]` validates, increments view_count, redirects to 5-min signed URL; `DELETE` revokes; `ShareDialog` in `DocumentManager` + `ShareDialogInline` on library page
- [x] **Link analytics** — `view_count` on `document_shared_links` table; incremented on each access via shared link; shown in `ShareDialog`

### Smart Document Features

- [x] **ATS keyword scan** — `POST /api/documents/ats-scan` extracts resume text via `document-parser.ts`, sends to Groq (llama-3.3-70b) with job description, returns JSON: `{ score, present_keywords, missing_keywords, suggestions, summary }`; rate-limited 5/min per user
- [x] **Document diff** — `DiffDialog.tsx` + `GET /api/documents/diff`; `diff` package installed; side-by-side version comparison
- [x] **Auto-fill from resume** — "Fill from resume" button in `ApplicationForm` loads library resumes via `/api/documents/list?is_master=true`; calls `parse-resume`; suggests `position` from `experience[0].title` when field is blank; offers to append skills summary to notes; no new API routes needed
- [x] **Cover letter variable substitution preview** — `CoverLetterPreviewDialog` in `DocumentManager`; shown on docs where label contains "cover" or MIME is text/plain or text/markdown; fetches document text, detects `{{token}}` placeholders, auto-fills `{{company}}` + `{{position}}` from application props, renders live substituted preview, copy-to-clipboard; shared `substituteVariables()` + `extractVariableKeys()` moved to `lib/utils/template-helpers.ts`

### Cloud Import

- [x] **Google Drive import** — Google Picker OAuth (`drive.file` scope); `GoogleDriveImportButton` component loads GAPI + GIS dynamically; server-side proxy `POST /api/documents/import-drive` fetches file from Drive API with `verifyOrigin`, rate limit (10/min), MIME + magic-byte + AV validation; wired into `DocumentManager` UploadArea and `/documents` library page; shows "not configured" disabled state when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` absent; `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_API_KEY` env vars added (optional)
- [x] **Dropbox import** — `DropboxImportButton` component loads Dropbox Chooser SDK (`dropins.js`) dynamically; chosen file URL piped through existing SSRF-protected `import-url` route (no new server route); `NEXT_PUBLIC_DROPBOX_APP_KEY` env var (optional); shows "not configured" disabled state when absent; wired into `DocumentManager` UploadArea and `/documents` library page
- [x] **URL-based import** — `POST /api/documents/import-url`; fetches public URL, validates Content-Type + magic bytes, stores in Supabase Storage; 15s timeout, 10 MB limit; available in both `DocumentManager` (per-application) and `/documents` library page

### Storage-Level Security

- [x] **Virus scan on upload** — Cloudmersive multi-engine AV on all uploads + URL imports; fail-open when `CLOUDMERSIVE_API_KEY` absent; magic-byte validation still runs regardless
- [x] **File content validation** — server-side magic-byte check on all uploads and URL imports (`validateMagicBytes()` in `storage.ts`); covers PDF (`%PDF`), DOCX (PK zip), DOC (OLE2), PNG, JPEG; rejects mismatched content
- [x] **Per-application Storage RLS** — migration 18 adds `user_owns_application()` PostgreSQL function (SECURITY DEFINER) called from all four Storage RLS policies; verifies `application_id` path segment belongs to calling user; library paths (`/library/`) bypass application check

---

## 🇺🇸 US Market — Entry & Junior Software Developer

> These features are purpose-built for the specific reality of a new/junior US software developer job search: visa status, ATS-optimised resumes, technical interview prep, total compensation math, and the networking-heavy US hiring culture.

---

### 🛂 Work Authorization & Sponsorship

- [x] **Work authorization field on profile** — dropdown: US Citizen, Green Card, H1B, OPT (F-1), CPT, TN Visa, EAD (Other); stored in `user_metadata`; surfaced as a badge on the profile sidebar
- [x] **OPT expiry tracker** — `OPTCountdownBanner.tsx` on dashboard; STEM flag (36 vs 12 months); severity tiers at 7/30/60 days; `opt_start_date` stored in `user_metadata` via migration 25
- [x] **Sponsorship flag per application** — `requires_sponsorship BOOLEAN NOT NULL DEFAULT FALSE` added via migration 25; present in `types/application.ts`, form validation, and services; "Needs sponsorship" filter on applications list
- [x] **Sponsorship status on application card** — "Visa sponsorship" badge rendered in `application-card.tsx` when `requires_sponsorship` is true
- [x] **H1B cap tracker** — `H1BTrackerCard.tsx` informational card with H1B lottery date and cap countdown; rendered on dashboard for OPT users

---

### 💰 US Total Compensation (TC) Calculator

- [x] **TC calculator card on `/salary`** — auto-compute annual TC = base + annual bonus + (equity / 4-year vest) + prorated signing bonus; displayed as the primary number on each row
- [x] **Equity / RSU vesting schedule** — `RSUVestingForm` component; total shares, cliff, vest months, current price; Year 1–4 schedule via `computeVestingSchedule()`; stored as `equity_details JSONB` on `salary_details`
- [x] **401(k) match calculator** — `retirement_match_percent` + `retirement_match_cap` fields; `compute401kMatch()` in `salary-helpers.ts`; included in `computeFullTC()`
- [x] **Cost of Living (CoL) normaliser** — `/api/salary/col-index` route; city+state stored per application; adjusts TC to Austin TX baseline
- [x] **Effective hourly rate** — `computeEffectiveHourlyRate(tc, annualHoursWorked, ptoDays)` in `salary-helpers.ts`; surfaced in offer comparison PDF
- [x] **State income tax estimator** — `estimateTakeHome()` in `lib/utils/tax-estimator.ts`; federal + state brackets hard-coded; net take-home shown per offer
- [x] **Benefits dollar value** — `computeBenefitsDollarValue()` using IRS/KFF 2026 benchmarks (health ~$7.2k, dental $500, vision $200); added to `computeFullTC()`
- [x] **Offer comparison PDF export** — `OfferComparisonPDF.tsx` + `POST /api/salary/export-pdf`; up to 3 offers side-by-side with full TC breakdown, net take-home, hourly rate; downloaded via `SalaryPageClient`

---

### 💻 Technical Interview Prep Hub (`/prep`)

> Junior devs spend 50-70% of their job search time on technical prep.

- [x] **New `/prep` dashboard page** — central hub with four progress rings (DSA solved, system design topics comfortable, behavioral questions drafted, mock interviews completed); daily streak counter + longest streak badge; fully tabbed layout
- [x] **LeetCode problem tracker** — `coding_problems` table with `title`, `url`, `difficulty`, `topic`, `status` (Todo/Attempted/Solved/Review), `company_tags`, `time_to_solve_minutes`, `notes`, `solution_url`, `last_reviewed_at`; filter pills by topic + difficulty; spaced-repetition Review queue (problems not visited in 7+ days surface at top with amber alert)
- [x] **Topic progress rings** — 4 SVG rings on the `/prep` dashboard header: DSA problems solved (N/total), system design topics comfortable (N/15), STAR behavioral answers drafted, mock interviews completed
- [x] **Company question bank** — problems table supports `company_tags TEXT[]`; filter by tag; users can attach company tags to any problem (e.g. Google, Meta, Amazon)
- [x] **Take-home assessment tracker** — `assessments` table with `application_id` FK (IDOR-validated ownership), `platform`, `deadline`, `time_limit_hours`, `tech_stack`, `status`; overdue detection with red banner; link to existing job_application
- [x] **System design study log** — 15-topic checklist (Load Balancer, CDN, Database Sharding, CAP Theorem, Rate Limiting, Message Queues, Caching, Consistent Hashing, SQL vs NoSQL + 6 more); click to cycle Not Started → Reading → Comfortable; progress bar; links to system-design-primer; persisted in `prep_streaks.system_design_progress JSONB`
- [x] **Behavioral question bank (STAR)** — `behavioral_answers` table; 15 pre-seeded questions across 8 competencies (Leadership, Conflict, Failure, Achievement, Teamwork, Communication, Problem Solving, Other); expandable STAR form (Situation, Task, Action, Result) per question; word count shown; filter by competency
- [x] **Interview question log** — `interview_questions` table with FK to `interviews` (ownership-validated); log questions per real interview; grouped by interview in the UI; category + difficulty per question
- [x] **Mock interview scheduler** — `mock_interviews` table; schedule DSA / Behavioral / System Design / Mixed sessions; post-session score (1-5 stars), feedback, topics to revisit; "Log result" inline form on past sessions; stats: upcoming count, completed count, avg score
- [x] **Daily prep streak** — `prep_streaks` table (one row per user); streak increments when any prep activity is logged; resets to 1 after a gap day; streak + longest streak shown in `/prep` header; every prep action (solve problem, advance system design, save STAR answer, complete mock) logs to streak

---

### 🐙 Developer Portfolio & Identity

- [ ] **GitHub integration** — OAuth scope `read:user,repo`; pull: username, avatar, bio, public repo count, top 6 pinned repos (name, description, language, stars, forks, URL); display as a "GitHub Profile" card on the user profile page; update daily via cron
- [ ] **Project showcase** — `projects` table: `name`, `description`, `tech_stack TEXT[]`, `github_url`, `live_url`, `thumbnail_url` (Supabase Storage), `status` (In Progress/Complete), `is_featured`, `built_at`; show on profile; when adding an application, select which projects are most relevant and link them (stored as `application_projects` junction)
- [x] **Skills inventory** — `skills` table: `name`, `category` (Language/Framework/Database/Cloud/Tool/Soft), `proficiency` (Beginner/Intermediate/Advanced/Expert), `years_experience`, `last_used_at`; full CRUD in profile; Zod-validated API with origin check, rate limit, UUID-guarded DELETE, 404 on stale ID
- [x] **Certifications tracker** — `certifications` table: `name`, `provider`, `credential_id`, `credential_url`, `issued_at`, `expires_at`; expires_at > issued_at enforced by Zod refine + DB CHECK; expiry/soon-expiring badge in UI
- [x] **Education section** — `education` table: `institution`, `degree` enum, `field_of_study`, `gpa` (opt-in display), `start_date`, `end_date`, `is_current`, `activities TEXT[]`; date-ordering enforced by Zod refine
- [ ] **LinkedIn profile sync** — store LinkedIn profile URL (already in contacts schema); prompt user to add their own LinkedIn URL in profile; "LinkedIn Strength" score checklist (headline, summary, 3+ experiences, 5+ skills, photo, 500+ connections)
- [ ] **Portfolio public page** — opt-in shareable `/p/{username}` page listing: name, title, GitHub stats, featured projects, skills, education, certifications; no job application data is visible; used as a link to share with recruiters instead of a personal website

---

### 🏢 Company Intelligence

- [ ] **Company tier tagging** — enum on `job_applications`: FAANG/MAANG, Tier 2 (Stripe/Databricks/Figma/OpenAI tier), Tier 3 (mid-size), Startup (Series A-C), Startup (Pre-seed/Seed), Government/Non-profit; filter and analytics by tier
- [ ] **Sponsorship reputation** — community-sourced boolean per company: "Sponsors H1B" (Yes / No / Unknown); pre-seeded list of top 500 US tech employers; user can flag/correct; surfaced as a badge when adding an application to a known company
- [ ] **Interview process wiki** — after completing an interview loop, user can contribute their anonymised process (rounds, question types, timeline, outcome) to a per-company wiki visible to all users; e.g. "Google SWE E3: 1 phone screen, 5 onsite, 1 Googleyness round, 4-6 week timeline"
- [ ] **Glassdoor / Blind sentiment** — link company name to Glassdoor search results page; show overall Glassdoor rating (fetched from a free public data source or user-input); "Work-life balance" and "CEO approval" sub-ratings for quick filtering
- [ ] **Response rate by company tier** — dashboard analytics card: your average days-to-response for FAANG vs Tier 2 vs Startup; helps calibrate follow-up timing per tier

---

### 🤝 Networking & Referrals

- [ ] **Referral tracker** — `referrals` table: `application_id`, `referrer_contact_id`, `referral_status` (Requested/Submitted/Pending/Converted), `referral_date`, `notes`; show "Referred" badge on application cards; analytics: referred applications have X% higher response rate vs cold applications
- [ ] **LinkedIn outreach log** — per contact: track outreach status (Not Contacted / Connection Request Sent / Connected / Message Sent / Replied / Coffee Chat Scheduled / Referral Requested); templated outreach messages in email templates (new category "Networking")
- [ ] **Alumni mapper** — user inputs their school(s) / bootcamp; system highlights contacts who attended the same institution (match on `education.institution` vs contact notes); alumni connections are prioritised in outreach suggestions
- [ ] **Coffee chat tracker** — `coffee_chats` table: `contact_id`, `scheduled_at`, `medium` (Zoom/Phone/In-person), `status`, `agenda`, `notes`, `follow_up_sent`; reminder auto-created 1 hour before; post-chat: log key takeaways and referral outcome
- [ ] **Connection goal widget** — set a weekly LinkedIn outreach goal (e.g. "5 new connections this week"); track against it in the dashboard; prompt with suggested contacts from target companies in the user's application list

---

### 🎯 Application Quality & ATS

- [x] **Job description store** — `job_description TEXT` field on `job_applications` (currently only `job_url` exists); paste or import the full JD text; powers ATS scan, keyword extraction, and NESTAi tailoring
- [x] **ATS compatibility score** — `/ats` scanner page (5 AI providers); keyword overlap pre-computed server-side; score persisted to `job_applications.ats_score`; badge on application card
- [x] **Resume tailoring checklist** — `POST /api/applications/[id]/tailoring-checklist`; Groq extracts 6–8 actionable tips from stored JD; sidebar card on detail page; checkbox state + items persisted to localStorage per application; progress bar; prompts to add JD if none stored
- [x] **Application completeness score** — 10-field ring on list cards (simple, no popup); full interactive checklist on detail page (client component, live-refetches on tab focus)
- [x] **Follow-up cadence enforcer** — `/api/cron/follow-up-reminders` (daily 09:00 UTC); auto-creates Day 7/14/21 reminders for Applied/Phone Screen apps; idempotent via description marker
- [x] **"Ghosted" status** — add `Ghosted` to `application_status` enum; auto-suggest after 30 days with no activity; analytics: % ghosted by company tier, job board source, season
- [x] **Application source tracking** — `source` field on `job_applications`: LinkedIn Easy Apply, Indeed, Company Website, Referral, Recruiter Outreach, Job Fair, Wellfound, Dice, Handshake, Other; analytics: which source has highest response rate for this user

---

### 📊 Analytics & Export

- [x] **Richer dashboard analytics** — "Search Intelligence" section on dashboard: `averageTimeToResponse` (avg days applied_date→updated_at for responded apps, 90-day cap), `interviewToOfferRate` ((Offer+Accepted)/(Interview+Offer+Accepted)×100, ≥3 threshold), `ghostRate` (Ghosted/total×100, ≥5 threshold); colour-coded tone cards; hidden on empty dashboard
- [ ] **US job search funnel** — visualise: Applied → Responded → Phone Screen → Technical → Onsite → Offer → Accepted; industry benchmark overlays (average conversion rates for entry-level SWE in the US); compare user's funnel vs benchmark
- [ ] **Weekly cadence report** — how many applications submitted this week vs goal; response rate trend; interview velocity (interviews per week); productivity chart; exportable as PDF
- [ ] **Salary benchmarking** — compare user's offers vs aggregated anonymised salary data from other Jobnest Pro users (same role, same city, same YOE range); "Your offer is in the Xth percentile for SWE-1 in San Francisco" — requires consent opt-in
- [ ] **Export improvements** — salary + tags in CSV/JSON, PDF summary per application; **new**: export entire job search history as a single PDF report with charts (application funnel, salary breakdown, timeline)

---

## 🔔 Notifications

- [x] **In-app notification bell** — `NotificationBell` client component in dashboard Navbar; polls `/api/notifications/count` every 60 s; red badge (capped 99+); popover with overdue-reminder and upcoming-interview rows; "View all →" links to `/notifications`
- [x] **Email digest** — weekly digest cron fully wired (sends every Monday 08:00 UTC); overdue reminder alert emails added (`sendOverdueReminderEmail()`); daily cron at 09:00 UTC; respects `notification_prefs.overdue_reminders` opt-in for email; bug fixed (cron was querying wrong column names `completed`/`due_date` → `is_completed`/`remind_at`)
- [x] **Persistent notifications page** (`/notifications`) — `notifications` table (migration 20) with RLS; `lib/notifications/create.ts` admin-client upsert helper; full-page UI with All/Unread/Read filter tabs, per-card read toggle + delete, "Mark all read" + "Clear all" bulk actions, cursor-based pagination ("Load more"), optimistic UI throughout; in-app notifications created by overdue-reminders cron for all users (overdue reminders + upcoming interviews within 24 h)

---

## 🔒 Security

- [x] **Next.js upgraded 16.1.6 → 16.2.1** — fixes HTTP request smuggling (GHSA-ggv3-7p47-pfv8), CSRF bypass (GHSA-mq59-m269-xvcx), DoS (GHSA-h27x-g6w4-24gq), dev HMR CSRF (GHSA-jcc7-9wpm-mj36)
- [x] **flatted prototype pollution fixed** — `npm audit fix` (GHSA-rf6f-7fwh-wjgh)
- [x] **CRON_SECRET guard fail-closed** — previously skipped auth entirely if `CRON_SECRET` env var was not set; now always enforces (endpoint returns 401 if secret missing or mismatched)
- [x] **Dual-layer rate limiting on send-otp** — IP-level (10/min) + per-email (3/min) gates prevent inbox flooding of arbitrary victims by rotating source emails
- [x] **IP extraction hardened** — `x-real-ip` preferred; last entry in `x-forwarded-for` used as fallback (first entry is user-controlled)
- [x] **Open redirect fixed** — `proxy.ts` now validates the `redirect` param; rejects `//evil.com` and scheme-like paths
- [x] **publicApiPrefixes collision fixed** — `/api/contact` matched exactly, not as a bare prefix
- [x] **Password reset user lookup** — replaces `listUsers()` O(n) scan (silently failed for users beyond page 1) with targeted REST fetch filtered by email
- [x] **hashOTP / secureCompare consolidated** — moved to `lib/security/otp.ts`; removed 4 inline duplicate definitions across route files
- [x] **Rate-limit store capped at 10 000 entries** — prevents unbounded memory growth under high cardinality key attacks
- [x] **Document Content-Type fixed** — extension-derived MIME type; `Content-Disposition: attachment` forced on all downloads (prevents stored XSS via uploaded HTML/SVG)
- [x] **Redis-backed rate limiting** — Upstash REST API (no persistent TCP, serverless-safe); falls back to in-memory when `UPSTASH_REDIS_REST_URL` is not set; all 20+ callers migrated to async API; survives cold starts and shared across all function instances
- [x] **`pdf-parse` upgrade 1.1.1 → 2.x** — upgraded to 2.4.5; `document-parser.ts` updated to new CJS entry point (no more internal `lib/pdf-parse.js` path)
- [x] **Environment variable validation on startup** — `lib/env.ts` + `instrumentation.ts`; Next.js instrumentation hook runs `validateEnv()` on server start; throws immediately with a clear list of missing required vars
- [x] **`sb_rm` cookie hardened** — uses `__Host-` prefix in production (binds to exact host, no Domain attribute, Secure required, Path=/); prevents subdomain injection; `auth-sync.tsx` and `proxy.ts` both fall back to the plain name in dev
- [x] **CSRF on profile API routes** — `verifyOrigin()` added to all 8 profile mutation routes; blocks cross-origin POST when Origin header is present and doesn't match `NEXT_PUBLIC_APP_URL`; defence-in-depth on top of SameSite=Lax
- [x] **SSRF protection on parse-jd** — `assertSafeUrl()` pre-resolves every user-supplied URL via `node:dns/promises` and rejects loopback, RFC-1918, link-local (AWS/GCP metadata 169.254.x), CGNAT, and IPv6 private ranges before the server-side fetch; post-redirect check on `res.url` blocks public→private open-redirect chains
- [x] **Storage path traversal fix on parse-file** — `session_id` FormData value now validated against a strict UUID regex before being interpolated into the Supabase Storage path; non-conforming values silently skip the upload (text extraction still succeeds)
- [x] **CSRF on parse-file** — `verifyOrigin()` added to the file-upload route (state-mutating POST that writes to Storage), matching the guard already on parse-jd and all profile routes
- [x] **Path traversal belt-and-suspenders on attachment-url** — explicit `path.includes("..")` rejection before the `startsWith` ownership check; `..` segments cannot reach another user's files even if Supabase Storage were to normalise them
- [x] **Full CSRF audit — verifyOrigin on all mutation routes** — security review identified 14 session-authenticated mutation routes missing `verifyOrigin()`: `documents/upload`, `documents/share` (POST + DELETE), `documents/ats-scan`, `documents/import-url`, `documents/[id]` DELETE, `documents/[id]/restore`, `documents/[id]/purge-versions`, `documents/[id]/annotations` (POST), `documents/[id]/annotations/[annId]` (PUT + DELETE), `nesta-ai` (POST), `nesta-ai/sessions` (POST), `nesta-ai/sessions/[id]` (PATCH + DELETE), `nesta-ai/sessions/[id]/messages` (POST + DELETE), `stripe/checkout`, `applications/[id]/status`, `profile/complete-onboarding`; all now guarded; annotation DELETE also fixed to return 404 on no-match instead of silent 200; `globals.d.ts` created for ambient Window types (Dropbox, GAPI, Google Picker)

---

## ⚙️ Infrastructure & DX

- [x] **Migrate `middleware.ts` → Next.js 16 `proxy` convention** — `web/proxy.ts`
- [x] **Dependencies upgraded** — `next@16.2.1`, `@supabase/supabase-js@2.100.0`, `tailwindcss@4.2.2`, `nodemailer@8.0.3`, `react-hook-form@7.72.0`, `react@19.2.4`, `react-dom@19.2.4`, `geist` installed
- [ ] **Major version upgrades (evaluate carefully)**:
  - ~~`lucide-react` 0.577 → 1.0.1~~ ✓ now `^1.7.0`
  - ~~`typescript` 5.9 → 6.0~~ ✓ now `^6.0.2`
  - ~~`pdf-parse` 1.x → 2.x~~ ✓ upgraded to `2.4.5`
  - `eslint` 9 → 10 (major — config format may change; currently on 9.x)
  - `@types/node` 20 → 25 (major; currently on `^20`)
- [ ] **Move document parse cache to Redis** — `document-parser.ts` currently has no caching at all (stateless parse on every call); add Redis-backed SHA-256 cache before scaling
- [ ] **Error monitoring** — integrate Sentry for server-side and client-side error tracking
- [x] **Vitest tests — 933 tests, 69 files, 100% pass (no browser, fully automated)**
  - Unit tests: `tests/unit/` — lib utilities (incl. signupFormSchema age+terms, rate-limit async/Redis, verifyOrigin CSRF, template-helpers substituteVariables), all API route handlers (auth, profile, documents, export, Stripe webhook + portal, GDPR export, cron + erasure, prep hub), proxy
  - E2E flow tests: `tests/flows/` — full user journeys: login (remember-me), signup (age/terms), forgot-password, change-password, delete+reactivate, NESTAi chat+upload, **Stripe billing** (checkout → webhook → portal → payment failure dunning → cancellation)
  - Playwright E2E: `tests/e2e/` — public pages, auth flows, UI smoke tests
  - No external services required — all run via `npm test` in any CI/CD environment

---

## 💳 Billing & Payments (Stripe)

> Core billing is now fully wired. Checkout, webhook (all 4 events), billing portal, dunning email, trial, and annual toggle are all live.

- [x] **Stripe Checkout / Payment Links** — `POST /api/stripe/checkout`; creates checkout session; supports monthly/annual interval; reuses existing Stripe customer if found; blocks duplicate active subscriptions (409)
- [x] **Stripe webhook handler** (`/api/stripe/webhook`) — verifies `stripe-signature`; handles all 4 events:
  - `checkout.session.completed` → upsert `subscriptions` row, `plan=pro`, `status=active`
  - `customer.subscription.updated` → sync `status`, `current_period_end`, `cancel_at_period_end`
  - `customer.subscription.deleted` → downgrade to `plan=free`, `status=canceled`
  - `invoice.payment_failed` → mark `status=past_due`, send dunning email with amount + next retry date
- [x] **Billing portal** — `GET /api/stripe/portal` creates Stripe customer portal session and redirects (303); return_url: `/profile`; 404 if no Stripe customer found
- [x] **Dunning emails** — `sendDunningEmail()` in `lib/email/nodemailer.ts`; HTML email with formatted charge amount, currency, next retry date, and direct portal link
- [x] **Trial period** — `trial: true` body param → `trial_period_days: 30` on subscription_data; student discount flow on pricing page
- [x] **Annual plan toggle** — `STRIPE_PRO_ANNUAL_PRICE_ID` wired; pricing page `PricingPlans` component switches Price ID based on selected interval; `annualReady` flag controls toggle visibility
- [x] **Plan enforcement middleware** — `lib/auth/plan.ts`: `getUserPlan(userId)` reads `subscriptions` via admin client (fail-closed — returns "free" on any error, never accidentally grants Pro); `requirePro(userId, featureName?)` throws `ApiError.paymentRequired()` (HTTP 402 `UPGRADE_REQUIRED`); NESTAi already enforces per-plan rate limits (5/min free, 30/min Pro)
- [x] **Student discount flow** — `GET /api/stripe/student-verify` server-side allow-list of 16 academic TLDs (`.edu`, `.ac.uk`, `.edu.au`, etc.); reads Supabase Auth email (cannot be client-spoofed); `PricingPlans` auto-detects on mount and shows "Your email qualifies" badge; non-`.edu` users can still use promo codes at Stripe checkout (`allow_promotion_codes: true`)
- [x] **Proration handling** — `POST /api/stripe/update-subscription`: retrieves live Stripe subscription, no-op guard if already on target price, calls `stripe.subscriptions.update` with `proration_behavior: "create_prorations"`; "Switch to annual / monthly" text link shown to active subscribers on pricing page

---

## 📈 Scalability & Infrastructure (1 M+ users)

- [x] **Redis-backed rate limiting** — Upstash REST API; falls back to in-memory when env var absent; all 20+ callers migrated (shipped — see Security section)
- [x] **Full-text search** — GIN-indexed `search_vector` tsvector; `websearch_to_tsquery`; `/api/search` endpoint (shipped — see Recently Shipped)
- [x] **Cursor-based pagination** — keyset pagination on applications list; "Load more" appends pages (shipped — see Recently Shipped)
- [ ] **Redis document-parse cache** — `document-parser.ts` has no caching at all; add Upstash Redis cache keyed on SHA-256 of file bytes, `CACHE_TTL=1h`
- [ ] **Database connection pooling** — route Supabase connections through **PgBouncer** (Supabase's built-in pooler at port 6543) to prevent connection exhaustion at high concurrency
- [ ] **CDN & asset optimisation** — ensure `next/image` uses Vercel Image Optimisation CDN; add far-future `Cache-Control` headers on `/public` static assets; consider Cloudflare in front of Vercel for global edge caching
- [ ] **Background job queue** — move heavy operations (PDF parse, email sending, AI calls) off the request path; use [Trigger.dev](https://trigger.dev) or Vercel Queue; prevents Vercel 10s timeout on large uploads
- [ ] **Vercel Edge Config** — store feature flags and plan limits in Edge Config for zero-latency reads without a DB round-trip
- [ ] **Supabase read replica** — enable read replica in Supabase dashboard for analytics queries; route dashboard stat queries to replica to offload primary

---

## 🔭 Observability & Reliability

- [ ] **Sentry** — integrate `@sentry/nextjs`; capture unhandled server errors, client errors, and slow API routes (> 2s); set `tracesSampleRate: 0.1` in production
- [ ] **Structured server logging** — replace `console.log` with [Pino](https://github.com/pinojs/pino); emit JSON logs to Vercel Log Drains → Datadog / Logtail / Better Stack
- [ ] **Web Vitals dashboard** — send `reportWebVitals` data to a `/api/vitals` collector or Vercel Speed Insights; alert if LCP > 2.5 s
- [ ] **Uptime monitoring** — add external synthetic checks on `/api/health` (Checkly / Better Uptime / UptimeRobot); page on-call channel if p99 > 3 s or error rate > 1%
- [x] **`/api/health` endpoint** — liveness + readiness probe; checks: Supabase ping, SMTP connectivity, Groq API reachability; returns `{ ok: true, checks: {...} }`
- [ ] **Alerting** — Slack / PagerDuty alerts for: Stripe webhook failures, cron job failures, error rate spikes, DB connection pool exhaustion
- [ ] **Audit log table** — structured `audit_events` table (actor, action, resource_type, resource_id, ip, timestamp); capture all mutating API calls for compliance and debugging

---

## 🚀 Performance

- [x] **Static public pages** — `/privacy`, `/terms`, `/cookies` converted to `force-static`; `/` and `/pricing` remain `force-dynamic` due to server-side auth redirect (planned: split into static shell + client hydration)
- [ ] **Bundle analysis** — run `ANALYZE=true npm run build` (via `@next/bundle-analyzer`); identify and code-split any chunk > 100 kB
- [ ] **Partial Prerendering (PPR)** — enable Next.js PPR on dashboard pages; static shell renders instantly, dynamic data streams in
- [ ] **Image optimisation** — compress and convert all landing page illustrations to WebP/AVIF; add `width`/`height` to all `<Image>` tags to eliminate CLS
- [ ] **Preload critical fonts** — verify Newsreader + Manrope `font-display: swap` is preventing FOIT; add `<link rel="preload">` for above-the-fold font weights
- [ ] **Service Worker / PWA** — `public/manifest.json` exists with full metadata (icons, shortcuts, standalone); still need `next-pwa` + service worker for offline shell and "Add to Home Screen" install prompt

---

## 🤖 NESTAi — AI Enhancements

- [x] **Model fallback chain** — primary `llama-3.3-70b-versatile`; falls back to `llama-3.1-8b-instant` on 429/5xx; amber "reduced capacity" banner shown via `X-NESTAi-Degraded` response header; prevents total AI outage
- [x] **Per-plan AI rate limits** — free: 5 req/min, Pro: 30 req/min; enforced server-side in NESTAi route by reading `subscriptions.plan` via admin client; fail-closed (free on error)
- [ ] **Cost guardrails** — track token usage per user per day in `ai_usage` table; hard-cap at 100k tokens/day for free, 2M for Pro; alert when approaching 80%
- [ ] **RAG over user data** — generate `pgvector` embeddings for applications, interview notes, and contacts; semantic similarity search at query time gives NESTAi far richer context than flat JSON injection
- [ ] **Resume analyser** — dedicated flow: user uploads resume → NESTAi grades it against ATS criteria, suggests improvements, extracts skills/experience to pre-fill application fields
- [x] **Job description parser** — "Import from job posting" button on new-application form; paste a URL or raw text → Groq (llama-3.3-70b) extracts company, role, location, salary range, and full JD; auto-fills all form fields; SSRF-protected URL fetch (DNS pre-resolution blocks private/loopback/AWS-metadata IPs + post-redirect check); falls back to paste-text tab if URL is blocked or unreachable
- [x] **Interview prep mode** — "Prep" button in NESTAi header opens a modal listing active applications (Applied/Phone Screen/Interview); select one → NESTAi generates 5 tailored STAR behavioral questions from the stored JD; user drafts answers and gets specific actionable feedback
- [x] **Email draft assistant** — "Draft" button in NESTAi topbar; 7 email categories (Follow Up, Thank You, Cold Outreach, Networking, Referral Request, Offer Negotiation, Withdrawal); optional contact picker (fetched lazily); `buildEmailPrompt()` sanitizes name/title (newline stripping), validates category against allowlist; prompt dropped into chat input for review before sending
- [x] **File preview + download in chat** — clicking any uploaded file card in NESTAi opens `ChatAttachmentPreview`; PDFs render in a sandboxed `<iframe>`, images in `<img>`, other types show extracted text; Download button uses a 10-min signed URL fetched from `/api/nesta-ai/attachment-url`; binary stored to Supabase Storage (`chat-attachments/{userId}/{sessionId}/…`) on upload via parse-file; path ownership enforced server-side before signing
- [x] 🔴 **NESTAi in-chat file viewer polish + file-in-message bug fix**
  - [x] **Binary-only file viewer** — `ChatAttachmentPreview` fully rewritten: PDF → CSP-safe blob URL in a native iframe (same approach as `/documents` DocPreviewDialog; no `#toolbar=0` suppression so full PDF controls show); Image → `<img>` with signed URL; TXT/MD → raw file bytes fetched from storage; DOCX/DOC → "Open in browser"; no extracted text shown in preview (independent from AI processing); Atelier-styled header with file type badge, download + open-in-tab buttons
  - [x] **File attached to submitted message (fixed)** — `msgAttachment` was only built when `!attachedFile.error`; now always built when a file is attached regardless of extraction outcome; `storagePath` was missing from `createChatMessageSchema` Zod schema and silently stripped before DB write — added `storagePath: z.string().max(500).optional()` so it persists across sessions; `onView` condition fixed to trigger on `storagePath` OR `preview` (not just `preview`)
  - [x] **Edit message in-place** — edit no longer appends a new message at the bottom; `handleEditSubmit` updates the message at its original position, drops AI responses after it, and streams a fresh reply; attachment preserved via `editingAttachment` state captured when edit is opened
  - [x] **Storage RLS fixed** — old path `chat-attachments/{uid}/…` failed RLS (`foldername[1]` was `chat-attachments`, not uid); new path `{uid}/chat-attachments/…` passes the existing policy; `user_owns_application()` extended to allow `'chat-attachments'` as a trusted second-segment; bucket MIME types expanded (migration 28/29)
  - [x] **`storagePath` always set** — `pendingStorageIdRef` generates a UUID before the first session exists so files uploaded on the very first message get a storagePath; `parse-file` now requires `session_id` and returns 500 (not silent null) if storage upload fails; all file types (images, txt, md) go through parse-file so every attachment is stored
  - [x] **Thinking indicator** — pulsing terracotta dots + avatar ping animation while waiting for the first streaming token; replaces previous bare empty-bubble state
- [ ] **Chat to PDF export** — "Export chat" button in the NESTAi sidebar or chat header; renders the entire conversation (user messages, AI responses including markdown, file attachment cards, timestamps) into a formatted single PDF; useful for saving interview prep sessions, sharing AI-generated advice with a mentor, or keeping a record of a job search strategy session
- [ ] **NESTAi usage analytics** — track which features users use most (resume upload, JD parse, interview prep); feed back into product roadmap

---

## 🌱 Growth & Retention

- [x] **Onboarding flow** — 3-step wizard (Welcome → Applications → NESTAi); `onboarding_completed` flag in user metadata; skip option; `proxy.ts` redirects new users to `/onboarding`
- [x] **Empty state CTAs** — filter mismatch shows "no results + clear filters"; new users (no search/filter) see 3-step guided walkthrough with NESTAi + Reminders shortcuts
- [ ] **Referral system** — `referrals` table; unique referral link per user; referred user gets 1-month Pro trial; referrer gets 1 free month after referee converts; track in dashboard
- [ ] **Feature flags** — integrate Vercel Edge Config or [Unleash](https://www.getunleash.io/) for runtime feature toggles; enable gradual rollout of new features to % of users without redeploy
- [ ] **A/B testing** — use Vercel Experiments or custom `x-variant` cookie + Edge Config; start with pricing page CTA button copy and plan layout
- [x] **Weekly digest email** — `/api/cron/weekly-digest` (Mondays 08:00 UTC) fully implemented; fetches per-user stats (apps this week, active pipeline, upcoming interviews, overdue reminders), recent apps and upcoming interview rows; sends via `sendWeeklyDigestEmail`; opt-in via `notification_prefs.weekly_digest`
- [x] **Re-engagement emails** — `/api/cron/re-engagement` (daily 10:00 UTC); targets users inactive ≥14 days; 30-day cooldown; opt-out toggle in profile notifications; PII-safe logs
- [ ] **NPS / in-app feedback** — show a 1-question NPS survey after 7 days of use and after major events (first offer recorded, account upgrade); store responses in `feedback` table

---

## 🔗 Integrations & Ecosystem

- [ ] **Chrome / Edge browser extension** — "Save to Jobnest" button on LinkedIn, Indeed, Glassdoor job pages; scrapes title, company, URL, salary; opens pre-filled "Add Application" side-panel via the Jobnest API
- [ ] **LinkedIn job import** — paste LinkedIn job URL → server-side fetch + parse (company, role, description, location, salary) → pre-fill application form
- [ ] **Google Calendar sync** — OAuth scope `calendar.events`; on interview creation, create a Google Calendar event with meeting URL and notes; sync updates/cancellations
- [ ] **Public REST API** (`/api/v1/`) — JWT-authenticated CRUD for applications, interviews, contacts; documented with OpenAPI 3.1; rate-limited per API key; enables Zapier / Make / n8n integrations
- [ ] **Zapier / Make native integration** — publish a Jobnest app on Zapier; triggers: "New Application", "Interview Scheduled"; actions: "Add Application", "Update Status"
- [ ] **CSV bulk import** — upload a CSV of applications (from LinkedIn "Applied Jobs" export or spreadsheet); map columns wizard; validate + preview before commit

---

## 🎨 Feature Expansion

- [x] **Kanban board view** — `KanbanBoard` component; `?view=kanban` URL param; `ViewToggle` in header; drag-and-drop across status columns; status updated via PATCH on drop
- [x] **Dark mode** — `.dark` class toggle; full black + #ccff00 palette in `globals.css`; `ThemeToggle` in Navbar; persisted in `localStorage`; logo swap + hardcoded colour overrides handled
- [x] **Application status timeline** — "Status Journey" card on application detail page; horizontal stepper (desktop) / vertical stack (mobile); derived from existing `activity_logs` (zero extra DB queries); days-elapsed per stage; terminal vs ongoing colour distinction; negative-day guard; invalid `applied_date` guard; hidden until first status change recorded
- [ ] **Company research panel** — in application detail, pull company info (size, industry, Glassdoor rating, news) from a public API (Clearbit, Crunchbase, or OpenCorporates); display as a collapsible sidebar panel
- [x] **Offer decision helper** — `OfferDecisionHelper` on /salary; select up to 3 Offer/Accepted applications; 5 per-offer criteria sliders (1–10) + 5 global weight sliders; live weighted score (0–100) with green/amber/red colouring; WinnerCallout sub-component; formatSalary passes actual currency; helpers inlined to avoid server-only import in client component
- [ ] **Document versioning** — keep previous resume/cover letter versions per application; label each version (v1, v2, tailored); view diff; avoids overwriting working documents
- [ ] **Reminder recurrence** — weekly / biweekly recurring reminders (e.g. "Check LinkedIn connections every Monday"); `rrule` column on reminders table
- [x] **Global command palette** — `components/ui/command-palette.tsx`; `⌘K` / `Ctrl+K`; full navigation, application search, keyboard shortcuts; built on Radix Dialog (no `cmdk` dep)
- [x] **Bulk actions** — `ApplicationsList` client component; selection checkboxes on every card; sticky bulk bar (set status, CSV export, two-step delete confirm); select all / deselect all; `effectiveSelected` derived state prevents stale cross-filter selections
- [x] **Application duplication** — `POST /api/applications/[id]/duplicate`; "Duplicate" in card dropdown; copies all fields, resets status to Applied + applied_date to today; toast on success/failure

---

## ♿ Accessibility & Internationalisation

- [ ] **WCAG 2.1 AA audit** — run [axe-core](https://github.com/dequelabs/axe-core) automated scan + manual keyboard-nav pass on every page; fix all critical / serious violations before launch
- [ ] **Skip-to-content link** — `<a href="#main-content">` as first focusable element; critical for screen reader and keyboard-only users
- [ ] **Focus management on route change** — on SPA navigation, move focus to the new `<h1>` so screen readers announce the new page
- [ ] **ARIA live regions** — toast notifications and streaming NESTAi responses should be wrapped in `role="status"` / `aria-live="polite"` so screen readers announce them
- [ ] **Colour contrast audit** — verify terracotta `#99462a` on parchment `#faf9f7` meets AA (4.5:1 for normal text, 3:1 for large); fix any failing combinations
- [ ] **i18n foundation** — add `next-intl`; externalise all UI strings to `messages/en.json`; add locale routing (`/en/`, `/es/`) even if only English ships initially — retrofitting i18n later is expensive
- [ ] **RTL support** — once i18n is in place, add `dir="rtl"` CSS mirroring for Arabic / Hebrew; Tailwind 4 has RTL utilities

---

## 🛡️ Security — Additional Hardening

- [ ] **Content Security Policy tightening** — current CSP allows `'unsafe-inline'` styles; move to nonce-based or hash-based CSP; eliminates the largest remaining XSS attack surface
- [ ] **Subresource Integrity (SRI)** — add `integrity` hashes to any third-party `<script>` / `<link>` tags loaded from CDNs
- [x] **Secrets scanning in CI** — `.github/workflows/secrets-scan.yml` using `trufflesecurity/trufflehog@v3.95.2` on push/PR to main
- [x] **Dependency update automation** — `.github/dependabot.yml` covering npm (`/web`) + GitHub Actions; weekly on Mondays
- [ ] **Security.txt** (`/.well-known/security.txt`) — disclose responsible disclosure policy and contact email; required by many bug bounty programs and enterprise customers
- [ ] **WAF** — put Cloudflare WAF in front of Vercel; enable OWASP Core Rule Set; add geo-blocking for high-abuse regions; bot management for scraping protection
- [ ] **Penetration test** — engage a third-party pentest firm before reaching 10k users; focus on auth flows, file upload, API, and Stripe webhook signature bypass

---

## 📋 Compliance & Data Governance

- [x] **GDPR data export** — `GET /api/profile/export-data`; exports profile + 9 data tables (applications, contacts, interviews, reminders, salary, templates, documents, NESTAi sessions, account_status) as a timestamped JSON attachment; rate-limited to 3/day; GDPR Art. 20 compliant
- [x] **Right to erasure verification** — deletion cron (`/api/cron/process-deletions`) now queries 9 tables after `deleteUser()` and logs `ERASURE WARNING` with row counts for any orphaned data; errors surfaced in cron response JSON
- [ ] **Right to erasure — Storage + Stripe** — verify Supabase Storage objects and Stripe customer are also purged after account deletion (Storage RLS cascade handles DB rows but Storage objects need explicit delete)
- [ ] **Data Processing Agreement (DPA)** — publish a DPA on the website for EU business customers; required by GDPR when a controller uses a processor
- [x] **CCPA compliance** — "Do Not Sell My Info" link added to landing page footer + pricing page footer; links to `/privacy#do-not-sell`; privacy page CCPA section anchored with `id="do-not-sell"`
- [ ] **Accessibility statement** — publish conformance level, known exceptions, and contact for accommodation requests; required for public-sector customers in many jurisdictions
- [ ] **Cookie consent banner** — see Legal section above; wire consent to `window.dataLayer` / analytics initialisation so no tracking fires before consent
- [ ] **SOC 2 Type I** — begin evidence collection (access logs, change management, incident response runbook) for SOC 2 audit; required by enterprise HR/recruiting customers

---

## 🧪 Testing at Scale

- [x] **Playwright E2E** — `tests/e2e/` exists with `auth.spec.ts`, `public-pages.spec.ts`, `ui.spec.ts`; Playwright config present
- [ ] **Visual regression** — integrate [Percy](https://percy.io) or [Chromatic](https://www.chromatic.com) with Playwright snapshots; catch unintended UI regressions on every PR
- [ ] **Load testing** — run [k6](https://k6.io) or [Artillery](https://www.artillery.io) load tests against staging; target: 500 concurrent users, p95 response < 800ms; run before every major release
- [ ] **Contract testing** — add [MSW](https://mswjs.io) handlers for Stripe and Groq API responses in tests; ensures the app doesn't break silently when third-party APIs change
- [ ] **Chaos engineering** — simulate Supabase unavailability, Groq timeout, and Redis eviction in staging; verify graceful degradation and error messages
- [ ] **Test coverage gate** — enforce minimum 80% statement coverage in CI; `vitest.config.ts` has thresholds but they are currently at ~47%/40%/42%/50% — raise to 80% and enforce in CI

---

## 🔍 SEO & Discovery

- [x] **Sitemap** (`/sitemap.xml`) — `app/sitemap.ts` with all 8 public pages; priorities and change frequencies set; excludes all authenticated routes
- [x] **`robots.txt`** — `public/robots.txt` with Disallow for all dashboard/API/auth routes; sitemap URL included
- [x] **OpenGraph & Twitter Card meta** — per-page `openGraph` + `twitter` metadata on all 6 public pages (landing, pricing, privacy, terms, cookies, contact); global fallback in root layout; `summary_large_image` on landing page
- [x] **Schema.org structured data** — `SoftwareApplication` + `WebSite` (SearchAction) + `FAQPage` JSON-LD on landing; `Product`+`Offer` schema on pricing; improves Google rich results + AI search engines (ChatGPT, Perplexity)
- [ ] **Core Web Vitals** — target: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on all public pages; measure with `@vercel/speed-insights`; fix before indexing push
- [ ] **Blog / content hub** (`/blog`) — 3-5 SEO-targeted articles (e.g. "How to track job applications", "Best job search tools 2026"); drives organic traffic and internal links to pricing

---

## 🐛 Known Issues

- [ ] Document parser has no cache at all — `document-parser.ts` parses on every call (stateless); add SHA-256 Redis cache before scaling
- [x] ~~Rate limiter is in-memory — resets on Vercel cold starts~~ — **fixed**: Upstash Redis-backed with in-memory fallback
- [x] ~~`pdf-parse` v1 + Turbopack issues~~ — **fixed**: upgraded to 2.4.5; new entry point used
- [x] ~~Scrollbar layout shift during page transitions (Windows Chrome)~~ — **fixed**: `html body[data-scroll-locked]` CSS rule overrides Radix scroll-lock compensation (overflow:unset, padding-right:0, margin-right:0); specificity 0,1,2 beats injected 0,1,1

---

_Last updated: 29 April 2026 — Full codebase audit (14 items newly marked done, 5 descriptions corrected); added HIGH PRIORITY NESTAi item: document library viewer panel + bug fix for file not being included in submitted chat message._

_Last updated: 2nd May 2026 — Shipped: Custom 404 not-found page (`app/not-found.tsx`) — Atelier design, dark mode, terracotta/lime palette, Newsreader + Manrope typography, security-hardened (no stack traces, robots noindex, no path reflection)._

_Last updated: 3rd May 2026 (sprint) — Shipped: Interview Prep Hub (all 10 sub-items: /prep dashboard, LeetCode tracker, system design checklist, STAR behavioral bank, take-home assessment tracker, mock interview scheduler, interview question log, daily streak, progress rings, company tags); NESTAi binary file viewer (PDF blob URL, image, TXT/MD raw fetch, DOCX open-in-browser; storagePath always persisted; edit-in-place; thinking indicator); OAuth error page Atelier redesign; 3 security fixes (CSRF on all 11 prep mutation endpoints, IDOR on interview_id/application_id, storage RLS path fix); 933 tests / 69 files all green._

_Last updated: 4th May 2026 — Shipped: All 5 Document Storage items — PDF annotation (PDF.js + server-side sticky notes, migration 30), resume autofill in application form, cover-letter variable substitution preview, Google Drive import (server-side proxy + Picker OAuth), Dropbox import (Chooser SDK + import-url pipeline); full CSRF audit — verifyOrigin added to 14 previously unprotected mutation routes (documents, NESTAi sessions, Stripe checkout, application status, onboarding); annotation DELETE silent-success bug fixed; `globals.d.ts` ambient types for browser SDKs; `pdfjs-dist` 5.x added to web/package.json; 933 tests / 69 files all green; TSC ✓ · Lint ✓ · Build 72 routes ✓._
