# Jobnest - Job Application Tracker

A modern, secure platform to organise and manage your entire job search. Built with Next.js 16, Supabase, and TypeScript.

**Live:** [jobnest.nishpatel.dev](https://jobnest.nishpatel.dev) · **By [Nish Patel](https://nishpatel.dev)**

> Found a bug or have a suggestion? [Open an issue](https://github.com/Git-Nish14/Jobnest/issues) · [View on GitHub](https://github.com/Git-Nish14/Jobnest)

---

## Features

### Authentication & Security
- Email/Password with **6-digit OTP verification** (Nodemailer, not Supabase Auth emails)
- **Google, GitHub & LinkedIn OAuth**: `/auth/callback` exchanges code and sets session; `linkedin_oidc` (OIDC provider, not legacy OAuth 2.0); callback route is provider-agnostic (`exchangeCodeForSession`)
- **Age verification + Terms acceptance**: required at signup before email or OAuth proceeds; applies equally to all three OAuth providers
- **Stay signed in 30 days**: `sb_rm=1` persistent; unchecked = session-only via `sessionStorage`; `__Host-` cookie prefix in production
- **Logout scope dialog**: clicking "Sign out" opens a two-option modal — "This device only" (`scope: "local"`) clears only the current session while other devices stay signed in; "Sign out of all devices" (`scope: "global"`) revokes the refresh token server-side ending every session; server action runtime-validates the scope string so crafted requests cannot pass the undocumented `"others"` scope to lock the user off all devices while keeping an attacker's session active
- **Cross-tab logout sync**: `AuthSync` listens to `onAuthStateChange`
- **Auto-redirect**: authenticated users bounce from auth pages to `/dashboard`
- Protected routes via Next.js 16 `proxy.ts` + Supabase SSR session refresh
- **Nonce-based CSP**: per-request cryptographic nonce injected into `script-src`; `unsafe-eval` removed; `strict-dynamic` enables Next.js code-splitting without whitelisting chunk URLs; fires on HTTPS and `x-forwarded-proto: https` (covers staging behind load balancers)
- HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy headers
- Redis-backed rate limiting (Upstash); dual-layer on send-otp (IP + per-email)
- SHA-256 hashed OTPs with timing-safe comparison
- **URL scheme allowlist** (`secureUrlField`): all URL fields (job URL, meeting URL, LinkedIn URL, etc.) now validate by parsing with the WHATWG URL parser and checking `protocol === "https:" || "http:"` — an allowlist approach that is immune to whitespace-interleaved bypasses (e.g. `javascript\t:` is stripped to `javascript:` by the URL parser but was not caught by the previous `startsWith` denylist); tabs are also stripped in the pre-transform step for defence-in-depth

### Profile Page
- Display name, About Me (bio), NESTAi Context (AI-specific instructions)
- **Work Authorization**: US visa status dropdown (8 options); shown as sidebar badge; injected into NESTAi system prompt
- **Notifications**: toggle for overdue reminders, weekly digest, re-engagement emails
- **Change / Set password**: 3-step OTP-verified; OAuth users can add a password; profile page now fetches live `app_metadata` via `admin.getUserById` on every load so `has_password` always reflects the real database state — not the stale JWT-cached value — fixing the "No password set" false-positive for users who had set a password in the same session
- **Delete account**: OTP-confirmed soft delete, 30-day grace period
- **GDPR data export**: all personal data as dated JSON (rate-limited 3/day)
- **Billing portal**: Stripe customer portal for Pro subscribers
- **Developer Identity**: Skills (name, category, proficiency, years experience), Certifications (issued/expiry dates, credential URL), Education (institution, degree, GPA opt-in, is_current); full CRUD with Zod validation, CSRF origin check, rate limiting, UUID-guarded deletes, and RLS-enforced ownership
- **Portfolio settings**: claim a username slug (30-day change cooldown enforced server-side; DELETE to remove), toggle public/private, opt-in contact email (defaults off); share URL shown immediately after claiming
- **Profile avatar upload**: click the avatar to upload a JPEG/PNG/WebP photo (≤ 2 MB); client-side pre-validation + server-side magic-byte verification (prevents content-type spoofing); stored in Supabase Storage at `{userId}/avatar/profile.{ext}` with a 10-year signed URL saved to `user_metadata.avatar_url`; purged on account deletion; **avatar shown in the Navbar** (nav trigger button, dropdown header, and mobile slide-panel footer) — falls back to the email-initial letter when no avatar is set; `user_metadata` is typed as `any` so a runtime `typeof === "string"` guard is applied before the URL reaches `<img src>` on both SSR and client paths
- **Profile page structure**: four labelled groups - **Profile** (Display Name, About You, NESTAi Context) / **Career** (Work Authorization) / **Preferences** (Notifications) / **Security** (Password, Danger Zone); sidebar shows exact OAuth providers (Google, GitHub, LinkedIn) without text truncation

### Developer Portfolio & Public Profile (`/p/{username}`)
- **GitHub OAuth**: connect GitHub using the same Supabase-configured OAuth app as login (no separate credentials needed); profile card with avatar, bio, location, follower/repo counts; pin up to 6 repos; manual sync (5/hr); daily cron at 04:00 UTC; access tokens **encrypted at rest** (AES-256-GCM)
- **Project showcase**: create and curate projects (title, description, tags, demo/repo URLs, **cover image URL**, featured flag); optional link to a cached GitHub repo for live star counts; drag-reorder via up/down controls; image preview on cards
- **LinkedIn strength**: URL auto-normalises on input; server-side reachability check on save; self-assessed 8-item checklist auto-saves per-toggle; **`has_photo` auto-detected** from LinkedIn OIDC `identity_data.picture` when user signs in via LinkedIn — pre-ticks the item and shows a `Sparkles` "auto" badge
- **Public portfolio page**: shareable `/p/{username}` page; SSR with full OpenGraph metadata; sections: hero (avatar, bio, links, GitHub stats), featured projects, pinned repos, skills by category, education, certifications; contact email shown only when explicitly opted in; no job application data ever exposed

### Account Deletion (Grace Period)
1. OTP-confirmed deletion request
2. Scheduled 30 days out; account stays fully accessible
3. 7-day reminder emails, 24h final warning email
4. Daily cron permanently erases after 30 days (RLS cascade)
5. Right-to-erasure verification - queries 9 tables for orphaned rows post-deletion

### Dashboard
- **Condensed navigation**: desktop nav bar shows 4 items — `Applications` (direct link), `Job Search` hover-dropdown (Interviews, Reminders, Contacts, Networking), `Tools` hover-dropdown (Templates, Salary, ATS Scan, Interview Prep), `NESTAi` (direct link with Sparkles icon); dropdowns open on mouse hover with a 120 ms close delay, also toggle on click, and close on Escape or Tab-away; mobile slide panel shows the same groups with section headers, with items already in the bottom tab bar excluded to prevent duplication; logo link to `/dashboard` replaces the former "Overview" nav item
- Stats: total applications, this week/month, active pipeline, offers, upcoming interviews
- **Application Velocity**: D / W / M granularity toggle; last 30 days (daily), last 24 weeks (weekly), or full account history from first application (monthly); per-mode window selectors; x-axis labels thin out automatically when many bars are shown
- Status distribution pie chart; Recent applications list; Tasks panel
- **Quick-access cards**: Document Library + ATS Scanner; H1B cap tracker for OPT/H1B users
- **Extended analytics** (shown when 3 or more applications):
  - **Monthly Breakdown**: grouped bars (Applied / Rejected / Offers); Applied is amber, Rejected is red, Offers are emerald so all three series are semantically distinct
  - **Weekday Activity**: Mon-Sun submission bars with peak-day callout; uses device-local time (not UTC) to prevent off-by-one for US time zones
  - **Top Companies**: ranked horizontal bar chart of most-applied companies
  - **Stage Funnel**: Applied to Phone Screen to Interview to Offer to Accepted cumulative counts; warm-to-cool colour gradient; **per-transition conversion rates** shown between each stage (e.g. "↓ 22%") colour-coded green/amber/red vs industry benchmark averages for entry-level SWE (Levels.fyi 2026 data)
  - **Avg Salary by Source**: midpoint of salary ranges per application source; handles `$90,000` comma-thousands format correctly
  - **Source Effectiveness**: response rate % per source, sorted descending; only sources with 2 or more applications shown
  - **Response Rate by Tier**: horizontal bar chart showing % of applications that received a reply per company tier (FAANG → Tier 1 → Tier 2 → Tier 3 → Startup); each tier needs ≥2 applications to appear; colour-coded from terracotta (FAANG) to blue (Startup); headline `responseRate` stat, per-tier, and per-source breakdowns now all use the same canonical `RESPONDED_SET` (includes Accepted) so every metric on the page agrees
- **Search Intelligence** — 6 context-aware metric cards (hidden until the user has ≥1 application):
  - **Avg. response time** — mean days from `applied_date` to first status change past Applied; 90-day cap filters outliers; requires ≥2 responded apps
  - **Interview → Offer** — `(Offer + Accepted) / (Interview + Offer + Accepted) × 100`; requires ≥3 at-interview apps to avoid misleading 100% on a single offer
  - **Ghosting rate** — counts both explicitly-Ghosted apps *and* Applied apps silent for >30 days (implicit ghosting); requires ≥5 total apps; fixes the "always 0%" bug where users who never manually set "Ghosted" status saw no signal
  - **Live opportunities** — Phone Screen + Interview app count; your hot active pipeline right now
  - **Weekly momentum** — this week's applications vs the trailing 4-week average (% change, capped at +500% so a burst week doesn't render "+9800%"); null when trailing average is zero
  - **Best source** — the application source (LinkedIn, Indeed, Referral…) with the highest response rate; requires ≥2 apps from at least one source
- **Weekly Cadence** — section below Search Intelligence (shown when ≥1 application exists): this-week count vs an editable weekly goal (stored in `localStorage`, default 5); animated progress bar; 12-week velocity bar chart; "Weekly report" button downloads a PDF summary (rate-limited 10/day)
- **Weekly Report PDF** — multi-section PDF: stats header, goal progress bar, 12-week SVG bar chart, funnel with conversion rates, source effectiveness table; generated server-side via `@react-pdf/renderer` at `GET /api/export/weekly-report?goal=N`

### Applications
- Full CRUD with status: Applied, Phone Screen, Interview, Offer, Rejected, Withdrawn, **Ghosted**
- **Job description field**: paste full JD to power ATS scan + NESTAi tailoring
- **Import from job posting**: paste a URL or raw JD text; Groq extracts company, role, location, salary range, and description and auto-fills the form; Greenhouse and Lever public APIs called first for reliable structured data; JSON-LD (`@type: JobPosting`) extracted before raw HTML; LinkedIn/Indeed/Glassdoor detected early with a specific paste-text message; URL fetch is SSRF-protected (DNS pre-resolution + post-redirect IP check)
- **AI JSON autofill**: copy a structured prompt from the new application form, paste it into any external AI (ChatGPT, Claude, Gemini) with your resume and the job posting, paste the returned JSON back, and all 13 fields auto-fill instantly; the `notes` field prompt now explicitly instructs the AI to include any extra answers written during the application (screening questions, "Why do you want to work here?", cover letter text) in addition to a fit summary; client-side only (no API key or extra service required); parser strips null bytes, validates real calendar dates, normalises URLs to canonical `href` form, and rejects dangerous schemes (`javascript:`, `data:`, etc.); invalid enum values produce non-blocking inline warnings with the modal staying open for review
- **ATS provider list expanded**: 11 new providers added — Paylocity, Paycor, UKG Pro, Workable, JazzHR, Breezy HR, Bullhorn, Cornerstone OnDemand, HireVue, Freshteam, Zoho Recruit (26 providers total); all validated in the application Zod schema and included in the AI JSON autofill prompt enum
- **Application detail — notes + job description visible**: notes and the full job description are now rendered on the application detail page, not just used for backend AI features; notes remain italic-quoted, job description uses `whitespace-pre-wrap` for line-break fidelity
- **Source tracking**: 11 sources (LinkedIn, Indeed, Referral, Company Website...); each source badge uses the platform's official brand colour (`SOURCE_COLORS` in `config/constants.ts`) with dark-mode variants
- **Application completeness score**: 10-field ring on list cards (visual only); full interactive checklist on detail page (auto-refreshes on tab focus); "Resume uploaded" and "Cover letter" fields check both the legacy `resume_path` field and `application_documents` rows so new applications (which no longer write to the legacy path) score correctly
- **ATS score badge**: persisted to DB after each scan; shown in bottom meta row
- **Created / Updated timestamps**: each application card shows device-local timestamps; only shown when the two differ
- **Status Journey**: visual stepper on application detail showing days spent at each status stage; horizontal on desktop, vertical on mobile; derived from activity logs (zero extra DB queries); each status dot uses its own semantic ring colour (amber for Applied, red for Rejected, emerald for Offer/Accepted) so every stage is visually distinct in both light and dark mode
- **Duplicate application warning**: while typing company + position on the new/edit form, a debounced (600 ms) check queries existing applications; non-blocking amber inline note appears if a match is found; never blocks submission
- **Delete application**: two-step delete available from both the card three-dot dropdown (menu stays open after first click so "Confirm delete" is immediately visible) and a "Delete" button on the application detail page header; server-side `DELETE /api/applications/:id` cleans up all associated Storage files before the DB cascade; animated spinner overlay shown on the card during deletion; backed by Playwright E2E tests
- **Document auto-purge on rejection**: when an application is rejected, a 30-day countdown begins to delete its Storage files; countdown + "Save to library" / "Keep files" banner shown on the application detail page; in-app notifications fire every 5 days; purge can be cancelled or files saved to the master library at any time; only Storage files are removed, the application row and all DB data are kept
- **Universal Filter dropdown**: status filter is a dropdown on all screen sizes with an active-count badge; removable active-filter chips appear below the search bar when filters are on; "Clear all" link when 2+ filters active; sort by date/company/position; search shows a terracotta spinner during the server round-trip so there is always visual feedback while results load; filter changes remount the list cleanly so stale "Load more" pages never pollute filtered views
- **Cursor-paginated list view**: keyset pagination on `(applied_date DESC, id DESC)`; "Load more" appends pages client-side without losing existing items; kanban view still loads all rows for drag-and-drop
- **Full-text search**: command palette (`Cmd+K`) searches applications via GIN-indexed `search_vector` column with `websearch_to_tsquery`; falls back to `ilike` on company/position; results appear inline with keyboard navigation
- **Company tier tagging**: tag each application as FAANG / Tier 1 / Tier 2 / Tier 3 / Startup; filter pill in the applications list with removable chip; Zod-validated in the application form; migration 33
- **Glassdoor rating field**: optional 1.0–5.0 rating field on the application form for personal Glassdoor assessments; when a company name is typed, a "Search →" link appears next to the label opening a Glassdoor search for that company; saved rating renders as a green ★ badge on the application card that links back to Glassdoor; stored as `NUMERIC(3,1)` with a DB-level `CHECK (1.0–5.0)` constraint; migration 44
- **CSV bulk import**: "Import CSV" button opens a 4-step wizard (upload to column-map with auto-matching to 5-row preview to confirm); papaparse parses in-browser; server validates every row with Zod (company + position required; status/date default when absent); dangerous URL schemes rejected; partial success shows per-row errors; 2 MB file cap + 500-row server cap; rate-limited 5/min
- Export to CSV (basic or with notes), JSON, or **Full Report (PDF)** — 4-page PDF: cover page, Search Intelligence metrics, funnel + source + velocity charts, full application log (up to 100 rows); generated server-side at `GET /api/export/pdf-report` (rate-limited 5/day); defence-in-depth `user_id` filter applied on top of RLS

### ATS Scanner (`/ats`)
- Upload any resume (PDF/DOCX/TXT/MD) + paste a job description
- **5 AI providers**: Groq (Llama 3.3 70B), OpenAI (GPT-4o mini), Anthropic (Claude Haiku 4.5), Google (Gemini 1.5 Flash), Perplexity (Sonar Small); UI shows only configured providers
- Server-side keyword overlap pre-computation anchors AI score to real data (no "always 82" bias)
- Returns: match score 0-100, missing keywords, matched keywords, improvement suggestions
- **NESTpro Audit tab**: 30+ checkpoint rubric (format, ATS readability, section completeness, content quality, impact signals, technical keywords); AI qualitative scoring blended 40/60 with rule-based checks; expandable category bars with AI evidence; key strengths + improvement areas; handoff to NESTAi with full category context
- **Continue in NESTAi**: pre-fills NESTAi input with contextual follow-up message

### Document Library (`/documents`)
- Personal library of reusable master documents (resumes, cover letter templates, certificates)
- Application-specific documents stay scoped to their application detail page
- **1 GB quota** with colour-coded progress bar
- Filter by type (PDF/DOCX/Image/Text)
- **Inline preview popup**: PDF iframe, image viewer, download + open-in-tab
- **PDF annotation**: full PDF.js canvas renderer; click to place colour-coded sticky notes at exact coordinates; drag to reposition; auto-save on blur; 5 colour presets; per-document server-side storage with RLS (`document_annotations` table, migration 30)
- **Cover letter variable preview**: live substitution of `{{company}}`, `{{position}}` and any `{{token}}` found in text/markdown cover letters; auto-fills application context; one-click copy to clipboard
- **Resume autofill in application form**: "Fill from resume" picker loads library resumes; calls `parse-resume` API; suggests position from experience; appends skills summary to notes
- **Google Drive import**: Google Picker OAuth (`drive.file` scope); server-side file download proxy (`/api/documents/import-drive`) with verifyOrigin, rate limit, MIME check, magic-byte validation, AV scan; shows setup banner when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is absent
- **Dropbox import**: Dropbox Chooser SDK (dynamic script); direct-link piped through existing `import-url` SSRF-protected route; shows setup notice when `NEXT_PUBLIC_DROPBOX_APP_KEY` is absent
- Upload, URL import, version history, restore, purge old versions
- **Virus scanned on upload**: Cloudmersive multi-engine AV (fail-open when key absent)
- Shareable links (1d/7d/30d expiry) with view count analytics
- Magic-byte server-side content validation on all uploads
- **ATS Scan button** on each compatible document card directs to `/ats?doc_id=`
- **Document card actions collapsed into ⋯ menu on narrow screens**: secondary actions (preview, PDF annotate, cover-letter variable preview) are grouped under a `MoreHorizontal` dropdown trigger; primary actions (download, share, delete) remain always-visible inline; frees the filename label from being reduced to a few characters in the 1/3-width sidebar at 1024px

### Application Documents (per-application)
- Each application has its own document section on the detail page
- Documents pre-fetched server-side for instant display with no loading flash
- Original filename preserved and shown as the subtitle (`original_name` stored on upload)
- **Single storage path** — files uploaded via the new application form are stored only in `application_documents`; the legacy `resume_path` / `cover_letter_path` fields on `job_applications` are no longer written for applications created on/after 2026-06-12, eliminating the previous duplicate-card bug
- Version history with restore and diff comparison
- Share links per document with expiry and view count

### Interviews
- Schedule per application; types: Phone Screen, Technical, Behavioral, On-site, Final
- Round tracking, duration, meeting URL, interviewer names, pre/post notes
- Status: Scheduled, Completed, Cancelled, Rescheduled

### Contacts
- Recruiters and hiring managers with **company, school, email, phone, LinkedIn, notes**
- Mark primary contacts; associate with applications
- **Outreach status tracking**: per-contact pipeline stage (Not Contacted → Connection Request Sent → Connected → Message Sent → Replied → Coffee Chat Scheduled → Referral Requested); editable inline from the Contacts form

### Networking (`/networking`)

Three-tab page for relationship-driven job searching:

**Outreach tab**
- Kanban-style pipeline board with one column per outreach stage; drag-free inline status dropdown on each card
- **Alumni mapper**: contacts whose `school` field matches any institution in your Education profile are highlighted with a 🎓 Alumni badge and surfaced at the top of suggested contacts
- **Connection goal widget**: set a weekly outreach target (saved to `user_metadata`); client-side ISO week calculation uses the browser's local timezone so the count is always accurate; suggested contacts list shows uncontacted people ordered by application linkage

**Referrals tab**
- Track referrals from contacts to job applications (status: Requested / Submitted / Pending / Converted)
- Status analytics strip (4 count cards); "Referred" violet badge appears on application cards when `has_referral = true`
- `has_referral` maintained by a Postgres trigger (`trg_referral_has_referral`) on `referrals` INSERT / UPDATE OF application_id / DELETE — no JOIN needed on the applications list
- **Security hardened**: POST and PATCH routes verify `application_id` ownership before writing; the trigger also enforces `user_id` ownership so a `SECURITY DEFINER` privilege escalation path is fully closed at both layers

**Coffee Chats tab**
- Schedule informational interviews with contacts (medium: Zoom / Phone / In-person / Google Meet / Teams)
- Log post-chat notes, referral outcome, follow-up status
- Auto-creates a reminder 1 hour before each future chat via the admin client
- Upcoming vs Past split re-evaluated client-side on every render (no stale snapshot)

**DB schema (migration 043)**
- New tables: `referrals`, `coffee_chats`
- Altered: `contacts` gains `company`, `school`, `outreach_status`, `last_contacted_at`; `job_applications` gains `has_referral`
- Indexes: `idx_referrals_*`, `idx_coffee_chats_contact_id`, `idx_contacts_outreach_status`

### Reminders
- Manual and **auto-generated cadence** (Day 7, 14, 21 for Applied/Phone Screen apps)
- Types: Follow Up, Interview, Deadline; mark complete; overdue detection
- **Bulk actions**: "Mark all complete" (marks all pending/overdue reminders at once), "Clear completed" (deletes completed section), "Delete all" (with confirmation dialog); buttons appear in the page header and update via router.refresh for instant UI feedback
- **Re-engagement emails**: automated email to users inactive 14+ days (30-day cooldown, opt-out in profile)
- **Milestone celebration emails**: automatic celebratory email at every 100th application (100, 200, 300…) and every 10th offer received (10, 20, 30…); warm terracotta/emerald gradient templates with personalised copy that escalates as the numbers grow; deduped via `user_metadata.app_milestone_last` and `offer_milestone_last` so re-sends never happen; both milestones written in a single `updateUserById` call to prevent metadata overwrite race; in-app notification created alongside each email
- **Weekly motivation emails**: sent every Wednesday at ~8am in each user's local timezone; personalised hook sentence (8-priority logic: offers > active pipeline > response rate > apps this week > total) with a 4-stat grid and a rotating 7-quote bank; progress bar nudge for users below 100 apps; skips opted-out users, those inactive > 30 days, and those with 0 applications; ISO week dedup prevents double-send across cron windows
- **Timezone capture**: `AuthSync` silently captures the user's IANA timezone and UTC offset once per day via `Intl.DateTimeFormat().resolvedOptions()` and stores it in `user_metadata` via `POST /api/profile/timezone` (non-blocking, retries on failure); stored for future Pro-plan sub-hourly scheduling; crons are once-daily/weekly (Hobby-plan compatible — Vercel Hobby limits crons to once per day)

### Email Templates
- Reusable templates by category; variable placeholders (`{{company}}`, `{{position}}`)
- One-click copy

### Salary Tracker
- Base salary, bonus, signing bonus, equity, benefits per application
- **Salary Comparison table**: shows **all** applications with salary data (not just Offers); status badge per row so Applied/Interview/Offer/Rejected context is visible at a glance; full TC, take-home estimate, and effective hourly rate columns
- Multi-currency; state income tax take-home estimate; effective hourly rate adjusted for PTO and working hours
- **Salary Benchmarking**: new section showing user's average salary vs P25/P50/P75 market ranges for entry-level SWE (0–3 YOE); tier picker (All / FAANG / Tier 1 / Tier 2 / Startup) filters both the user's average and the benchmark band; data sourced from Levels.fyi / LinkedIn Salary 2026 aggregates; dot position on the range bar shows whether the user is above/below market median
- **Offer Decision Helper**: select up to 3 offers, rate 5 criteria (Total Comp, Career Growth, Location, Culture, Benefits), adjust global importance weights; live weighted score + winner callout

### Loading States
- Every dashboard page has an Atelier-themed skeleton (SalarySkeleton, ATSSkeleton, DocumentsSkeleton, PrepSkeleton, NotificationsSkeleton, ProfileSkeleton) that renders instantly during server-side data fetching
- Search box shows a terracotta spinner (`Loader2 animate-spin`) while the server re-renders after a filter change
- Application cards show a centred spinner overlay during deletion

### NESTAi - AI Job Search Assistant
- ChatGPT-style interface; full access to applications, interviews, reminders, contacts, salary, documents
- **Semantic RAG context (Pro)**: pgvector-backed retrieval — at query time NESTAi embeds your question with `text-embedding-3-small`, does cosine-similarity search across your stored application/contact/reminder embeddings, and injects only the most relevant chunks as context instead of a full data dump; lazy-indexes with a 2-hour TTL cache; falls back to full-context approach when `OPENAI_API_KEY` is absent or for Free users; requires pgvector extension + migration 047; `nestai_semantic_search` RPC enforces ownership
- **Streaming responses** with stop button; markdown rendering; suggested follow-ups; animated "Thinking..." indicator while awaiting first token; `aria-live="polite"` on the streaming bubble so screen readers announce incoming content
- **Chat-to-PDF export**: "Export" button in NESTAi topbar; styled PDF with user/AI bubbles, timestamps, and session title via `@react-pdf/renderer`; downloads as `nestai-{title}.pdf`; RLS-enforced
- **Work authorization aware**: user's visa status injected into system prompt
- **File attachments**: PDF, DOCX, TXT, MD, images up to 5 MB; binary always stored to Supabase Storage via `parse-file`; binary-only preview modal (PDF to CSP-safe blob URL iframe with full native PDF viewer, Image to `<img>`, TXT/MD to raw file bytes, DOCX to "Open in browser"); preview independent from AI text extraction; 10-min signed URLs; preview survives page navigation (storagePath persisted in `chat_messages.metadata`)
- **Edit messages in-place**: edited message stays at same position; AI response replaces the one after it; file attachment preserved through edit
- **Interview Prep**: "Prep" button opens a modal; pick an active application to generate 5 tailored STAR behavioral questions from the stored JD; provide draft answers for specific AI feedback
- **Email Draft Assistant**: "Draft" button opens a modal; pick an email category (Follow Up, Thank You, Cold Outreach, Networking, Referral Request, Offer Negotiation, Withdrawal) and an optional contact; Groq drafts a professional email into the chat input for review and editing
- **NESTpro Audit in NESTAi**: "NESTats" button opens a resume picker + optional JD; builds a structured 30+ checkpoint audit prompt and streams a full graded analysis (grade A+…F, top-tier readiness, critical fixes, BEFORE→AFTER rewrites)
- **Mobile ⋯ action sheet**: all topbar actions (Prep, Draft, NESTpro Audit, Export, New Chat) accessible on mobile via a `⋯` button that opens a custom bottom sheet with descriptions; Escape key and backdrop tap to dismiss
- **Model fallback**: primary `llama-3.3-70b-versatile`; auto-falls back to `llama-3.1-8b-instant` on Groq 429/5xx; amber "reduced capacity" banner shown to user
- Pin chats, edit messages, rename/delete sessions with confirm dialog
- Rate limits: 5 req/min free · 30 req/min Pro; live counter with countdown and progress bar
- Smart context trimming (4-step, 124,500-token budget); 100-message history
- **NESTAi handoff from ATS**: sessionStorage pre-fills input after a scan

### Technical Interview Prep Hub (`/prep`)
- **Dashboard**: 4 SVG progress rings (DSA solved, system design comfortable, behavioral drafted, mocks completed) + daily streak counter with longest-streak badge
- **Coding tracker**: LeetCode-style problem log with title, URL, difficulty, topic, status (Todo/Attempted/Solved/Review), company tags, solve time, notes; filter by topic/difficulty; spaced-repetition Review queue surfaces problems not visited in 7+ days
- **System design checklist**: 15 topics (Load Balancer, CDN, CAP Theorem, Rate Limiting, Message Queues, Caching, Consistent Hashing, SQL vs NoSQL...); click to cycle Not Started to Reading to Comfortable; links to system-design-primer; persisted to DB
- **STAR behavioral bank**: 15 pre-seeded questions across 8 competencies; expandable Situation/Task/Action/Result form per question; filter by competency; word count shown
- **Take-home assessment tracker**: platform, deadline, time limit, tech stack, status (Pending/In Progress/Submitted/Passed/Failed), score; link to a job application; overdue detection
- **Mock interview scheduler**: schedule sessions by type (DSA/Behavioral/System Design/Mixed); log post-session score (1-5 stars), feedback, topics to revisit
- **Interview question log**: log questions asked in real interviews, grouped by interview; category + difficulty tags; builds a personal question bank over time
- **Daily prep streak**: any prep activity increments the streak; resets after a gap day; longest streak preserved

### Notifications
- **Real-time bell**: Supabase Realtime channel (`postgres_changes`) on `reminders` + `interviews` tables scoped to `user_id=eq.{userId}` — badge updates instantly on any DB change; 5-minute fallback poll for resilience; no more 60-second polling lag
- Badge caps at 99+; popover with quick links
- `/notifications` page - All/Unread/Read tabs, bulk mark-read/clear, cursor pagination
- Daily cron: in-app notifications for overdue reminders + upcoming interviews (24h window)
- Idempotent via `(user_id, source_type, source_id)` partial unique index

### Billing & Payments (Stripe)
- Checkout, 4 webhook events, billing portal, dunning email, 30-day trial, annual toggle
- Plan enforcement fail-closed (reads `subscriptions` via service-role, returns "free" on DB error)
- Student discount - server-side `.edu` allow-list (16 academic TLDs)
- Mid-cycle proration for monthly to annual switch

### SEO & GEO
- **JSON-LD**: `SoftwareApplication`, `WebSite` (SearchAction), `FAQPage` on landing; `Product`+`Offer` on pricing
- **llms.txt**: plain-English site description for ChatGPT, Perplexity, Google AI, Claude
- Per-page `openGraph` + `twitter` metadata on all 6 public pages
- Sitemap auto-generated at `/sitemap.xml` via `app/sitemap.ts`
- `robots.txt` with all authenticated routes disallowed

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router, Turbopack) |
| Language | TypeScript 6.0.2 |
| Database | Supabase (PostgreSQL + RLS) |
| Storage | Supabase Storage |
| Auth | Custom OTP via Nodemailer + Supabase Auth (email + Google/GitHub OAuth) |
| AI - NESTAi | Groq (`llama-3.3-70b-versatile`) + OpenAI `text-embedding-3-small` (RAG, Pro only) |
| AI - ATS Scanner | Groq, OpenAI, Anthropic, Google Gemini, Perplexity |
| Email | Nodemailer (SMTP) |
| Billing | Stripe (checkout, webhooks, portal, dunning) |
| Virus scanning | Cloudmersive (multi-engine AV, fail-open) |
| Rate limiting | Upstash Redis (falls back to in-memory) |
| Styling | Tailwind CSS 4 + dark mode - Intellectual Atelier design system |
| UI | Radix UI primitives + custom atelier-themed components |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Cron | Vercel Cron Jobs |
| PDF Annotation | PDF.js (`pdfjs-dist` 5.x, CDN worker) |
| Cloud Import | Google Picker API + Dropbox Chooser SDK |
| Testing | Vitest (1750 tests, 106 files) + Playwright E2E (19 spec files) |
| Error monitoring | Sentry (`@sentry/nextjs`) |
| Web Vitals | Vercel Speed Insights (`@vercel/speed-insights`) |
| Bundle analysis | `@next/bundle-analyzer` (`npm run analyze`) |

---

## Project Structure

```
web/
├── app/
│   ├── (auth)/                   # Login, signup, forgot-password
│   ├── (dashboard)/              # Protected dashboard pages
│   │   ├── dashboard/
│   │   ├── applications/         # List + [id] detail + [id]/edit + new
│   │   ├── ats/                  # ATS Scanner (server component, pre-fetches docs)
│   │   ├── documents/            # Document Library (master docs only)
│   │   ├── interviews/
│   │   ├── reminders/
│   │   ├── contacts/
│   │   ├── templates/
│   │   ├── salary/
│   │   ├── nestai/
│   │   ├── prep/                 # Interview Prep Hub (problems, system design, STAR, mocks)
│   │   ├── notifications/
│   │   └── profile/
│   ├── (public)/                 # Public pages (shared LandingHeader + LandingFooter)
│   │   ├── page.tsx              # Landing page with JSON-LD structured data
│   │   ├── pricing/              # Pricing page with JSON-LD Product schema
│   │   ├── privacy/
│   │   ├── terms/
│   │   ├── contact/
│   │   └── cookies/
│   ├── p/[username]/             # Public portfolio page - SSR, no auth required
│   ├── api/
│   │   ├── auth/                 # send-otp, verify-otp, reset-password
│   │   ├── profile/              # update-name, change-password, update-about-me,
│   │   │                         # update-nestai-context, update-notifications,
│   │   │                         # update-work-authorization, update-portfolio-visibility,
│   │   │                         # delete-account, reactivate-account, verify-change-otp,
│   │   │                         # export-data (GDPR), complete-onboarding
│   │   ├── portfolio/
│   │   │   ├── github/           # connect (OAuth redirect), callback, disconnect,
│   │   │   │                     # connection (GET), repos (GET/PATCH pin), sync (POST)
│   │   │   ├── projects/         # list/create + [id] update/delete
│   │   │   ├── linkedin/         # GET/POST - URL + strength checklist
│   │   │   └── username/         # GET availability, POST claim
│   │   ├── cron/
│   │   │   ├── process-deletions/        # Daily 09:00 UTC
│   │   │   ├── overdue-reminders/        # Daily 09:00 UTC
│   │   │   ├── weekly-digest/            # Mondays 08:00 UTC
│   │   │   ├── follow-up-reminders/      # Daily 09:00 UTC - Day 7/14/21 auto-reminders
│   │   │   ├── re-engagement/            # Daily 10:00 UTC - 14-day inactivity emails
│   │   │   ├── github-sync/              # Daily 04:00 UTC - refresh all GitHub connections
│   │   │   ├── purge-rejected-documents/ # Daily 03:00 UTC - 30-day document cleanup
│   │   │   ├── milestone-celebrations/   # Daily 09:00 UTC - app-count (×100) + offer (×10) milestone emails
│   │   │   └── weekly-motivation/        # Wednesday 09:00 UTC - weekly motivational email
│   │   ├── documents/            # list, upload, [id], [id]/annotations, [id]/annotations/[annId],
│   │   │                         # ats-scan, import-url, import-drive, share, shared, refresh-url, diff, parse-resume
│   │   ├── health/               # Liveness + readiness probe
│   │   ├── applications/
│   │   │   ├── [id]/             # DELETE (with Storage cleanup), status PATCH, duplicate POST,
│   │   │   │                     # tailoring-checklist POST, retain-documents POST
│   │   │   ├── parse-jd/         # POST - JD URL/text to structured fields (SSRF-protected)
│   │   │   └── bulk-import/      # POST - CSV row validation + insert
│   │   ├── nesta-ai/             # Chat (streaming), sessions, messages, parse-file,
│   │   │                         # attachment-url (signed URL for chat file preview)
│   │   ├── notifications/
│   │   ├── stripe/               # checkout, webhook, portal, student-verify, update-subscription
│   │   └── contact/
│   ├── sitemap.ts                # Auto-generates /sitemap.xml (8 public pages)
│   └── opengraph-image.tsx       # 1200x630 OG image
├── components/
│   ├── ui/
│   ├── applications/             # ApplicationCard (with delete spinner overlay),
│   │                             # DeleteApplicationButton, DocumentPurgeBanner,
│   │                             # CompletenessCard, CompletenessRing, StatusTimeline
│   ├── ats/                      # ATSScanner client component
│   ├── auth/
│   ├── common/                   # Skeletons (Dashboard, Applications, ApplicationDetail,
│   │                             # Salary, ATS, Documents, Prep, Notifications, Profile,
│   │                             # NestAi, Generic), Loading, EmptyState
│   ├── dashboard/
│   ├── documents/                # DocumentManager, AnnotationDialog, DocPreviewDialog, DiffDialog
│   ├── layout/                   # Navbar, BottomTabBar, NotificationBell, ThemeToggle, ScrollRestorer
│   ├── prep/                     # PrepHub, CodingProblemsTracker, SystemDesignChecklist,
│   │                             # BehavioralBank, AssessmentsTracker, MockInterviewScheduler,
│   │                             # InterviewQuestionLog
│   ├── portfolio/                # GitHubSection, ProjectsSection, LinkedInSection,
│   │                             # PortfolioSettings
│   └── profile/                  # ProfileClient, DeletionBanner, DeveloperIdentity
├── lib/
│   ├── api/
│   ├── auth/                     # plan.ts - fail-closed plan enforcement
│   ├── email/                    # Nodemailer - all email types
│   ├── notifications/
│   ├── security/                 # OTP, rate-limit (Redis), CSRF, virus-scan (Cloudmersive), sanitize.ts
│   ├── utils/
│   │   ├── completeness.ts       # Application completeness scoring (10 fields, 0-10)
│   │   ├── date.ts               # Shared date/time formatting - Intl locale + IANA timezone from device
│   │   ├── document-parser.ts    # PDF/DOCX/TXT extraction with SHA-256 Redis cache (1h TTL)
│   │   ├── fetch-retry.ts
│   │   ├── storage.ts
│   │   └── template-helpers.ts  # substituteVariables() + extractVariableKeys()
│   ├── env.ts                    # Startup env validation
│   └── validations/              # Zod schemas; secureUrlField shared transformer
├── services/
├── config/                       # Constants (APPLICATION_STATUSES, APPLICATION_SOURCES, WORK_AUTHORIZATION_OPTIONS)
├── types/
├── public/
│   ├── llms.txt                  # LLM-readable site description (GEO)
│   └── robots.txt
├── vercel.json                   # 7 cron job schedules
└── proxy.ts                      # Route protection + security headers

supabase/
└── migrations/                   # SQL migration files (run in order, 000 to 035)
```

---

## Getting Started

### Prerequisites

- Node.js 18+, npm
- Supabase project
- SMTP server (OTP + lifecycle emails)
- Groq API key (NESTAi - required)
- Stripe account (billing - optional, degrades gracefully)
- Upstash Redis (rate limiting - optional, falls back to in-memory)
- Cloudmersive API key (virus scanning - optional, skipped when absent)
- Google / GitHub OAuth credentials (optional)

### Environment Variables

Copy `web/.env.local.example` to `web/.env.local`. Key variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App URLs
NEXT_PUBLIC_SITE_URL=https://jobnest.nishpatel.dev
NEXT_PUBLIC_APP_URL=https://jobnest.nishpatel.dev

# Security (generate with: openssl rand -hex 32)
CSRF_SECRET=...
CRON_SECRET=...

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
CONTACT_EMAIL=contact@yourdomain.com

# AI - NESTAi (required) + ATS Scanner providers (optional)
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-...        # optional
ANTHROPIC_API_KEY=sk-ant-... # optional
GEMINI_API_KEY=...           # optional
PERPLEXITY_API_KEY=pplx-...  # optional

# Virus scanning (optional - 800 free scans/month)
CLOUDMERSIVE_API_KEY=...

# Google Drive import (optional - set both or neither)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_GOOGLE_API_KEY=...

# Dropbox import (optional)
NEXT_PUBLIC_DROPBOX_APP_KEY=...

# GitHub OAuth - Developer Portfolio
# The portfolio GitHub connect uses the same OAuth app already configured in
# Supabase for login (Auth > Providers > GitHub). No separate app needed.
# Add the callback URL to Supabase > Auth > URL Configuration > Redirect URLs:
#   https://yourdomain.com/api/portfolio/github/callback

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...

# Redis (optional)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

See `web/.env.local.example` for all variables with descriptions and a setup checklist.

### Database Setup

Run migrations in order from `supabase/migrations/` via the Supabase SQL editor:

| # | File | Purpose |
|---|---|---|
| 00 | `...000_initial_schema.sql` | `job_applications` table + RLS |
| 01 | `...001_storage_setup.sql` | Storage bucket |
| 02 | `...002_security_functions.sql` | Security helpers |
| 03 | `...003_enhanced_features.sql` | Tags, salary, contacts, reminders, templates |
| 04 | `...004_otp_codes.sql` | OTP table |
| 05 | `...005_chat_history.sql` | NESTAi sessions + messages |
| 06 | `...006_pending_deletions.sql` | Soft-delete |
| 07 | `...007_pending_deletions_improvements.sql` | Audit columns, OTP purposes |
| 08 | `...008_chat_pin.sql` | Pin chats |
| 09 | `...009_chat_message_metadata.sql` | File attachment metadata |
| 10 | `...010_subscriptions.sql` | Stripe billing |
| 11-15 | Rate limits, RLS fixes, index cleanup | Performance + security |
| 16 | `...016_application_documents.sql` | Document versioning table |
| 17 | `...017_storage_expanded_mime.sql` | Extended MIME types |
| 18 | `...018_per_app_rls.sql` | Per-application Storage RLS |
| 19 | `...019_activity_logs.sql` | Activity timeline |
| 20 | `...020_notifications.sql` | Notifications table |
| 21 | `...021_ats_fields.sql` | `job_description`, `source`, Ghosted/Withdrawn statuses |
| 22 | `...022_ats_score.sql` | `ats_score` column |
| 23 | `...023_fulltext_search.sql` | `search_vector` tsvector + GIN index + trigger |
| 24 | `...024_developer_identity.sql` | `skills`, `certifications`, `education` tables with RLS |
| 25 | `...025_sponsorship_and_work_auth.sql` | `requires_sponsorship`, `opt_start_date` |
| 26 | `...026_salary_details_tc.sql` | TC calculator fields: `equity_details`, `retirement_match_*`, `col_city` |
| 27 | `...027_prep_hub.sql` | `coding_problems`, `assessments`, `behavioral_answers`, `mock_interviews`, `interview_questions`, `prep_streaks` |
| 28 | `...028_chat_attachments_storage.sql` | Expand documents bucket MIME types |
| 29 | `...029_allow_chat_attachments_path.sql` | Extend `user_owns_application()` for chat-attachments paths |
| 30 | `...030_document_annotations.sql` | `document_annotations` table with RLS |
| 31 | `...031_portfolio.sql` | `usernames`, `github_connections`, `github_repos`, `projects`, `application_projects` |
| 32 | `...032_ats_provider.sql` | `ats_provider` column on `job_applications` |
| 33 | `...033_company_tier.sql` | `company_tier` enum + column |
| 34 | `...034_feedback.sql` | `user_feedback` table |
| 35 | `...035_document_purge_queue.sql` | `document_purge_queue` table + DB trigger that schedules 30-day file purge on rejection |

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
npm run dev           # Development server (Turbopack)
npm run build         # Production build
npm run start         # Production server
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm test              # Vitest (1676 tests, 101 files)
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E — 17 spec files; authenticated suites require E2E_TEST_EMAIL + E2E_TEST_PASSWORD
npm run analyze       # Webpack bundle analysis — opens interactive treemap (ANALYZE=true next build)
```

---

## Testing

**Vitest** unit and flow tests run entirely without a browser or external service. Playwright E2E tests require a live Supabase backend and are skipped automatically when credentials are absent.

| Suite | Location | What it covers |
|---|---|---|
| Unit | `tests/unit/` | lib utilities, all API route handlers, analytics (incl. implicit ghost rate), Zod schemas, security helpers, **performance sprint** (next.config.ts bundle analyzer + AVIF/WebP + Supabase hostname scoping, font consolidation across 5 layouts, SW v2 cache names + offline pre-caching + null-guard, offline page force-static, manifest icon references), **Aug 2026 sprint** (download proxy `original_name` lookup + CRLF/NUL sanitisation, upload route control-char sanitisation in `original_name`, cron SMTP 500 guard for milestone-celebrations + weekly-motivation) |
| Flow | `tests/flows/` | Login, signup, forgot-password, change-password, delete+reactivate, NESTAi chat+upload, Stripe billing, developer identity, portfolio |
| E2E (Playwright) | `tests/e2e/` | Public pages, auth flows, UI smoke tests, application delete (card + detail page), application filters + search (spinner, stale data, URL state, status pills), **Search Intelligence** (all 6 cards visible, ghost rate non-zero, live opportunities count, empty-dashboard guard), **Mobile UX** (bottom tab bar, nav-open slide-away, nav dedup, NPS API, chart no overflow), **Applications redesign** (card renders position/company/status, title nav, always-visible mobile actions, status pills filter+URL+reset, count row, mobile FAB visible/hidden), **Resume Audit** (unauthenticated 401 guards, ATS tab layout, weekly goal profile persistence with real Supabase, single-header Edit on mobile, SW v2 cache names, API validation real-DB), **Performance sprint** (/offline page 200+HTML+content, /sw.js v2 caches+null-guard+no auth pre-caching, /manifest.json icon-192/512 references, --font-newsreader/--font-manrope CSS vars on body, offline browser simulation via context.setOffline), **Aug 2026 sprint** (upload-on-pick storage request fires before submit, "Uploading…" spinner while upload is in flight, non-PDF magic-byte toast + zero network calls, form lock during submit, navbar dropdown fully opaque, unauthenticated download proxy 401) |

---

## Performance

| Feature | Detail |
|---|---|
| Image formats | AVIF + WebP served automatically via Next.js Image Optimisation (`formats: ["image/avif", "image/webp"]`); PNG fallback for older browsers; 30-day CDN cache (`minimumCacheTTL: 2592000`) |
| Image proxy scoping | `remotePatterns` scoped to the specific Supabase project hostname (derived from `NEXT_PUBLIC_SUPABASE_URL`) — prevents `/_next/image` acting as an open proxy for arbitrary Supabase projects |
| Bundle tree-shaking | `optimizePackageImports` configured for `lucide-react` (1400+ icons), all Radix UI packages, and `sonner` — only the components actually imported ship to the client |
| Bundle analysis | `npm run analyze` opens a Webpack bundle treemap (`ANALYZE=true next build` via `@next/bundle-analyzer`) |
| Font loading | Newsreader + Manrope declared once in root `app/layout.tsx` and cascade via CSS variables — previously loaded independently in 5 sub-layouts causing duplicate preload hints |
| No Google Fonts CDN | `next/font/google` self-hosts all fonts at build time — no runtime CDN requests; the `preconnect` to `fonts.googleapis.com` was removed |
| Supabase preconnect | `<link rel="preconnect">` + `<link rel="dns-prefetch">` for the Supabase storage origin (for avatar images), derived from env var |
| Offline PWA | Service worker pre-caches `/offline` at install; navigation requests are network-first with the offline page as fallback (not the browser dino); null-guard ensures a cache miss never crashes the SW |
| PWA icons | `manifest.json` now references `icon-192.png` (192×192) and `icon-512.png` (512×512 maskable) — previously all four icon slots pointed to `new_logo_1.png` |

---

## Security

| Feature | Detail |
|---|---|
| OTP | SHA-256 hashed, timing-safe comparison, 5 purposes |
| Rate limiting | Redis-backed (Upstash); dual-layer on send-otp (IP + per-email) |
| Virus scanning | Cloudmersive multi-engine AV on all uploads + URL imports (fail-open) |
| Magic bytes | Server-side content validation prevents extension spoofing |
| CSRF | `SameSite=Lax` + `verifyOrigin()` on all session-authenticated mutation routes |
| IDOR | Application and document ownership verified server-side before every mutation |
| SSRF | `assertSafeUrl()` on parse-jd: DNS pre-resolution blocks loopback, RFC-1918, link-local (AWS/GCP metadata), CGNAT; post-redirect check prevents open-redirect chains |
| Path traversal | `session_id` validated as UUID before use in Storage path; `..` segments rejected; Storage paths scoped to `{uid}/` prefix with ownership check before all admin operations |
| Cron auth | `Authorization: Bearer <CRON_SECRET>` - fail-closed (401 if secret missing) |
| Right-to-erasure | Deletion cron purges Supabase Storage and Stripe customer before `auth.admin.deleteUser()`; orphan verification queries 9 tables post-delete |
| CSRF origin | `verifyOrigin()` validates `Origin` against `NEXT_PUBLIC_APP_URL` (static allowlist); `x-forwarded-host` spoofing not accepted in production |
| RLS | All tables enforce row-level security via `auth.uid()` |
| Plan enforcement | Reads `subscriptions` via service-role - fail-closed, never grants Pro on error |
| Document download filename | `Content-Disposition` uses `original_name` from `application_documents` DB row (user's chosen filename e.g. `John_Doe_Resume.pdf`) instead of the raw storage path segment (`resume.pdf` or `1750000000_name.pdf`); falls back to path segment for legacy uploads |
| HTTP header injection | All values embedded in `Content-Disposition` headers are sanitised: control chars (CR/LF/NUL) stripped first, then header-grammar punctuation (`"`, `\`, `;`, `,`) replaced; empty-after-strip falls back to `"document"` — applied at both DB write time (upload route + ApplicationForm inserts) and read time (download proxy) for defence in depth |
| SMTP config guard | Cron handlers (`milestone-celebrations`, `weekly-motivation`) call `checkSmtpConfig()` before the user loop; return HTTP 500 immediately if SMTP env vars are absent — prevents silent per-user failures where the root cause is a missing env var; all per-email failures now log at `console.error` level (visible in Vercel Function logs) |
| Document serving | `Content-Disposition: attachment` forced - prevents stored XSS |
| Startup validation | `instrumentation.ts` throws on missing required env vars |
| Headers | HSTS, nonce-based CSP (no `unsafe-eval`; `strict-dynamic`), X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| Input validation | UUID format check on all profile DELETE routes; `notes` field capped at 50,000 chars |
| GitHub token at rest | AES-256-GCM encryption in `lib/security/tokens.ts` keyed from `CSRF_SECRET` |
| Email disclosure | `user.email` never exposed on public portfolio by default; `show_email` must be explicitly opted in |
| `has_password` flag | Written to `app_metadata` (admin/service-role–only writable) — users cannot self-set via `supabase.auth.updateUser`; profile page reads from `app_metadata.has_password`, not `user_metadata`; password + flag + timestamp written in a single atomic `updateUserById` call to prevent partial-update window |

---

## Deployment

### Vercel

1. Push to GitHub then import project (root: `web/`)
2. Add all environment variables
3. Deploy

`vercel.json` schedules 7 cron jobs automatically:

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/process-deletions` | Daily 09:00 UTC | Grace-period account deletion |
| `/api/cron/overdue-reminders` | Daily 09:00 UTC | In-app notifications + emails |
| `/api/cron/weekly-digest` | Mondays 08:00 UTC | Digest email |
| `/api/cron/follow-up-reminders` | Daily 09:00 UTC | Day 7/14/21 auto-reminders |
| `/api/cron/re-engagement` | Daily 10:00 UTC | 14-day inactivity emails |
| `/api/cron/github-sync` | Daily 04:00 UTC | Refresh GitHub profile + repos for all connected users |
| `/api/cron/purge-rejected-documents` | Daily 03:00 UTC | Delete Storage files 30 days after application rejection |

**`CRON_SECRET` must be set** - all cron endpoints return 401 without it.

---

## Contributing / Issues

Found a bug? [Open an issue on GitHub](https://github.com/Git-Nish14/Jobnest/issues).

---

## License

Private - All rights reserved

---

Built by [Nish Patel](https://nishpatel.dev)
