# Jobnest — TODO & Roadmap

Tracked next steps ordered roughly by priority. Check off items as they ship.

---

## 🔐 Auth

- [ ] **OAuth — Google & GitHub sign-in/sign-up**
  - Wire up Supabase OAuth providers (Google, GitHub) in the Supabase dashboard
  - Enable redirect-based OAuth flow via `supabase.auth.signInWithOAuth()`
  - Handle `/auth/callback` route to exchange the code and set the session
  - Remove `disabled` + `opacity-50` from the OAuth buttons on login/signup pages
  - Merge OAuth users with existing email/password accounts where email matches
  - Test both new-user and returning-user flows

- [ ] **Session persistence across tabs**
  - Listen to `supabase.auth.onAuthStateChange` globally and sync logout across browser tabs

- [ ] **Remember me / longer session TTL**
  - Add a "Stay signed in" checkbox that extends the JWT expiry

---

## 👤 Profile Page

- [ ] **Build `/profile` route under `(dashboard)`**
  - Display current account info: email, joined date, plan
  - Update display name / avatar (initials-based until custom avatar is added)
  - Change password flow (current password → new password with OTP re-verification)
  - Delete account with confirmation (cascade delete all user data via Supabase RLS)

- [ ] **NESTAi AI context section on profile**
  - Free-text "About Me" field — career goals, current role, industry, preferred locations, skills
  - This gets injected into the NESTAi system prompt as additional user context
  - Example fields: current title, years of experience, target roles, target salary range, preferred work type (remote/hybrid/on-site)

- [ ] **Notification preferences**
  - Email reminders for overdue items
  - Weekly summary email of job search progress

---

## 🤖 NESTAi — AI Assistant

### Memory & History
- [ ] **Increase per-session message history from 10 → 100**
  - Update `history.slice(-10)` to `history.slice(-100)` in the API route
  - Adjust `max` on the Zod `history` array validation accordingly
  - Monitor token usage — add a token estimate guard before sending to Groq

- [ ] **Pin important chats**
  - Add a `is_pinned` boolean column to the `chat_sessions` table
  - Pinned chats appear at the top of the sidebar, separated by a divider
  - Toggle pin via the session context menu (⋯)

- [ ] **Full delete / rename in sidebar** *(partially done — polish)*
  - Confirm dialog before deleting a session instead of instant delete
  - Rename via inline edit or a modal
  - Keyboard shortcut: `Enter` to confirm, `Escape` to cancel rename

### File Attachments in Chat
- [ ] **Drag-and-drop / click-to-attach files directly in the NESTAi input**
  - Support PDF, DOCX, TXT uploads inline in the chat
  - Parse the file client-side (or send to a `/api/nesta-ai/parse-file` endpoint) and inject the extracted text into the next message
  - Show a file chip above the textarea (with ✕ to remove) before sending
  - Cap per-message file size at 5 MB

- [ ] **Reliable PDF/DOCX text extraction** *(currently WIP)*
  - Fix `pdf-parse` v1 integration in Next.js Turbopack environment
  - Test with image-only PDFs and fallback gracefully with a clear message
  - Consider switching to `pdfjs-dist` (Mozilla's maintained library) for better compatibility

### Generation Control
- [ ] **Stop / abort AI response mid-stream**
  - Switch from a single `fetch()` response to a **streaming** Groq API response (`stream: true`)
  - Use `ReadableStream` on the server and `EventSource` / `fetch` with `AbortController` on the client
  - Show a "Stop" button (■) while the response is streaming; hide once complete
  - Partial response is shown incrementally as tokens arrive

### Context & Intelligence
- [ ] **User profile context in system prompt**
  - Once the profile "About Me" section is built, prepend it to the NESTAi system prompt
- [ ] **Smart context trimming**
  - Estimate token count before sending; if over ~100K tokens, summarise older history automatically
- [ ] **Suggested follow-up questions**
  - After each assistant response, suggest 2–3 relevant follow-up prompts the user can tap

---

## 📱 Responsive Design

- [ ] **Mobile navigation overhaul**
  - Current mobile menu works but the dashboard nav links require scrolling on small screens
  - Consider a bottom tab bar on mobile for the most-used dashboard sections (Overview, Applications, Interviews, NESTAi)

- [ ] **NESTAi sidebar on mobile**
  - Sidebar should be a full-screen drawer on mobile (`sm:` breakpoint), not a side panel that collapses to 0 width
  - Swipe-to-open gesture

- [ ] **Application detail page — mobile layout**
  - Stack the two-column layout vertically on small screens
  - Make action buttons sticky at the bottom on mobile

- [ ] **Forms — mobile keyboard handling**
  - Ensure inputs are not obscured by the on-screen keyboard on iOS/Android

- [ ] **Table / list views — horizontal scroll on small screens**
  - Interviews, salary comparison, templates list

---

## 🎨 Design

- [ ] **Onboarding flow for new users**
  - Empty dashboard with a "Get started" guide — add first application, set first reminder, explore NESTAi
  - Step indicator or checklist card on the dashboard until the user has ≥ 3 applications

- [ ] **Application Kanban view**
  - Toggle between the current list view and a Kanban board grouped by status (Applied → Phone Screen → Interview → Offer)
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

- [ ] **Redis-backed rate limiting**
  - Replace the in-memory rate limiter with Redis (e.g. Upstash) so limits survive server restarts and work across multiple instances

- [ ] **Move document parse cache to Redis**
  - Same motivation — in-memory cache is lost on cold starts

- [ ] **Environment variable validation on startup**
  - Throw a clear error at boot if `GROQ_API_KEY`, `SMTP_HOST`, etc. are missing

- [ ] **Error monitoring**
  - Integrate Sentry (or similar) for server-side and client-side error tracking

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

---

*Last updated: March 2026*
