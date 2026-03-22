# Jobnest — TODO & Roadmap

Tracked next steps ordered roughly by priority. Check off items as they ship.

---

## 🚨 Next Session — Must Do First

These are environment/infrastructure tasks that are **blocking production correctness** right now. Do these before anything else.

- [ ] **Run Supabase migration 7**
  - Open Supabase dashboard → SQL editor
  - Run `supabase/migrations/20240101000007_pending_deletions_improvements.sql`
  - This fixes the broken UNIQUE constraint on `pending_deletions` and adds the `delete_account` OTP purpose

- [ ] **Update `web/.env.local`**
  - Add `NEXT_PUBLIC_APP_URL=https://jobnest.nishpatel.dev`
  - Add `CRON_SECRET=<generate: openssl rand -hex 32>`
  - Confirm `NEXT_PUBLIC_SITE_URL=https://jobnest.nishpatel.dev` (not jobnest.app)

- [ ] **Update Vercel environment variables** (Settings → Environment Variables)
  - Add `NEXT_PUBLIC_APP_URL=https://jobnest.nishpatel.dev`
  - Add `NEXT_PUBLIC_SITE_URL=https://jobnest.nishpatel.dev`
  - Add `CRON_SECRET=<same value as .env.local>`
  - Redeploy after adding

---

## 🔐 Auth

- [ ] **OAuth — Google & GitHub sign-in/sign-up**
  - Wire up Supabase OAuth providers (Google, GitHub) in the Supabase dashboard
  - Enable redirect-based OAuth flow via `supabase.auth.signInWithOAuth()`
  - Handle `/auth/callback` route to exchange the code and set the session
  - Remove `disabled` + `opacity-50` from the OAuth buttons on login/signup pages
  - Merge OAuth users with existing email/password accounts where email matches

- [ ] **Session persistence across tabs**
  - Listen to `supabase.auth.onAuthStateChange` globally and sync logout across browser tabs

- [ ] **Remember me / longer session TTL**
  - Add a "Stay signed in" checkbox that extends the JWT expiry

---

## 👤 Profile Page

- [x] **Build `/profile` route under `(dashboard)`**
  - Account info: email, joined date, plan, last password changed
  - Display name update (initials-based avatar)
  - Change password (3-step: current password → OTP → new password)
  - Delete account — OTP-confirmed soft delete with 30-day grace period

- [x] **Soft-delete / account grace period**
  - 30-day grace period with 7-day reminder emails
  - 24-hour final warning email
  - Inline cancel button on profile page + dashboard banner
  - Daily Vercel Cron job permanently deletes expired accounts
  - IP address + optional reason recorded for audit

- [ ] **NESTAi AI context section on profile**
  - Free-text "About Me" field — career goals, current role, industry, preferred locations, skills
  - Injected into the NESTAi system prompt as additional user context
  - Example fields: current title, years of experience, target roles, target salary, preferred work type

- [ ] **Notification preferences**
  - Email reminders for overdue items
  - Weekly summary email of job search progress

---

## 🤖 NESTAi — AI Assistant

### Memory & History
- [ ] **Increase per-session message history from 10 → 100**
  - Update `history.slice(-10)` to `history.slice(-100)` in the API route
  - Adjust `max` on the Zod `history` array validation
  - Monitor token usage — add a token estimate guard before sending to Groq

- [ ] **Pin important chats**
  - Add `is_pinned` boolean column to `chat_sessions` table
  - Pinned chats appear at the top of the sidebar, separated by a divider
  - Toggle pin via the session context menu (⋯)

- [ ] **Full delete / rename in sidebar** *(partially done — polish)*
  - Confirm dialog before deleting a session instead of instant delete
  - Rename via inline edit or a modal
  - Keyboard shortcut: `Enter` to confirm, `Escape` to cancel rename

### File Attachments in Chat
- [ ] **Drag-and-drop / click-to-attach files directly in the NESTAi input**
  - Support PDF, DOCX, TXT uploads inline in the chat
  - Parse the file and inject extracted text into the next message
  - Show a file chip above the textarea (with ✕ to remove) before sending
  - Cap per-message file size at 5 MB

- [ ] **Reliable PDF/DOCX text extraction** *(currently WIP)*
  - Fix `pdf-parse` v1 integration in Next.js Turbopack environment
  - Consider switching to `pdfjs-dist` for better compatibility

### Generation Control
- [ ] **Stop / abort AI response mid-stream**
  - Switch to streaming Groq API response (`stream: true`)
  - Use `ReadableStream` on server and `AbortController` on client
  - Show a "Stop" button (■) while streaming

### Context & Intelligence
- [ ] **User profile context in system prompt**
  - Once "About Me" is built, prepend it to the NESTAi system prompt
- [ ] **Smart context trimming**
  - Estimate token count; if over ~100K tokens, summarise older history
- [ ] **Suggested follow-up questions**
  - After each response, suggest 2–3 relevant follow-up prompts

---

## 📱 Responsive Design

- [ ] **Mobile navigation overhaul**
  - Consider a bottom tab bar on mobile for most-used sections (Overview, Applications, Interviews, NESTAi)

- [ ] **NESTAi sidebar on mobile**
  - Full-screen drawer on mobile instead of collapsing side panel
  - Swipe-to-open gesture

- [ ] **Application detail page — mobile layout**
  - Stack two-column layout vertically on small screens
  - Sticky action buttons at the bottom

- [ ] **Forms — mobile keyboard handling**
  - Ensure inputs are not obscured by on-screen keyboard on iOS/Android

- [ ] **Table / list views — horizontal scroll on small screens**
  - Interviews, salary comparison, templates list

---

## 🎨 Design

- [ ] **Onboarding flow for new users**
  - Empty dashboard "Get started" guide
  - Step checklist card until user has ≥ 3 applications

- [ ] **Application Kanban view**
  - Toggle between list view and Kanban board grouped by status
  - Drag-and-drop cards to change status

- [ ] **Dark mode** *(removed — re-evaluate based on user feedback)*

---

## 📊 Analytics & Export

- [ ] **Richer dashboard analytics**
  - Average time between application and first response
  - Interview-to-offer conversion rate
  - Most common rejection stage

- [ ] **Export improvements**
  - Include salary details and tags in CSV/JSON export
  - Export a single application as a PDF summary

---

## 🔔 Notifications

- [ ] **In-app notification bell**
  - Badge count for overdue reminders and upcoming interviews (within 24 hours)
  - Dropdown list of recent alerts

- [ ] **Email digest**
  - Weekly summary: applications sent, interviews coming up, overdue reminders

---

## ⚙️ Infrastructure & DX

- [ ] **Redis-backed rate limiting** *(known production limitation)*
  - Replace in-memory rate limiter with Upstash Redis or Vercel KV
  - Current limiter resets on every Vercel cold start — limits are not airtight

- [ ] **Move document parse cache to Redis**
  - Same motivation — in-memory cache lost on cold starts

- [ ] **Environment variable validation on startup**
  - Throw clear error at boot if `GROQ_API_KEY`, `SMTP_HOST`, etc. are missing

- [ ] **Error monitoring**
  - Integrate Sentry for server-side and client-side error tracking

- [ ] **End-to-end tests**
  - Auth flow (signup → OTP → dashboard)
  - Application CRUD
  - NESTAi session creation and message flow

---

## 🐛 Known Issues

- [ ] PDF/DOCX text extraction in NESTAi is unreliable — `pdf-parse` v1 + Turbopack bundling conflict
- [ ] OAuth buttons are visible on login/signup but non-functional (disabled state)
- [ ] No confirmation dialog before deleting a chat session in NESTAi
- [ ] Document parse cache is in-memory — lost on server restart
- [ ] Rate limiter is in-memory — resets on Vercel cold starts (see Infrastructure section)

---

*Last updated: March 2026*
