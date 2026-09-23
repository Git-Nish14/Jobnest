# Jobnest ChatGPT plugin — implementation plan and handoff

Last updated: 2026-09-22. Status: **local implementation complete; automated checks and production build pass. Hosted migration/deployment and live ChatGPT acceptance remain.**

## User request and decisions

Users tailor resumes in ChatGPT. After applying, they should be able to say **JOBNEST** and save the job directly to their own Jobnest tracker. Jobnest Settings must explain how to connect ChatGPT and identify the correct account securely.

The user explicitly requested **modern ChatGPT plugins**, not a Custom GPT Action. The user also requested this persistent checklist so another AI can continue if the session stops. Keep this file current after meaningful changes and verification.

### Research conclusions

- Modern ChatGPT plugins can expose tools through an MCP server. The official quickstart describes adding a personal plugin using its MCP URL, then installing it and selecting it with `@` in a ChatGPT Work conversation. [OpenAI plugin quickstart](https://developers.openai.com/plugins/quickstart)
- Authenticated plugin MCP servers use OAuth 2.1, resource discovery, authorization-server metadata, and PKCE. ChatGPT's MCP client does not support the proposed copy/paste custom API-key setup. Users will instead sign into Jobnest and approve a scoped connection. [OpenAI plugin authentication](https://developers.openai.com/plugins/build/auth)
- Custom GPT Actions were initially considered because their documented API-key authentication matches the original wording. They are **not the chosen implementation**. Do not reintroduce their OpenAPI schema, private GPT setup, or visible API keys. The fetched official documentation does not establish a discontinuation date for GPTs. [GPT Actions documentation](https://developers.openai.com/api/docs/actions/introduction)
- A connected/enabled plugin is required. The word JOBNEST is not a universal trigger in an ordinary unconfigured chat. Do not promise unrestricted availability: developer mode and plugin access can depend on account/workspace policy.
- Personal development setup and a publicly listed plugin are different delivery stages. Users with appropriate access can add the deployed server themselves. Public directory distribution requires a separate submission/review. [Connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt)

## Intended user flow

1. Open Jobnest Account Settings → Set up ChatGPT plugin.
2. Copy the deployed Jobnest MCP URL.
3. In ChatGPT, enable Developer mode under Settings → Security and login, if available.
4. Add a plugin named Jobnest from Plugins using that URL and OAuth authentication/discovery.
5. Sign into Jobnest in the browser. Review and approve permission to save job applications.
6. Install the personal plugin. Start a ChatGPT Work conversation and select `@Jobnest`.
7. Tailor a resume and, after actually applying, type JOBNEST. ChatGPT extracts known job fields, asks for missing required details, and calls `save_job_application`.
8. Jobnest saves only to the connected account and returns the saved record link. Retries do not create duplicate records.
9. Settings shows connection status and last successful save. Disconnect revokes access.

## Architecture and boundaries

- Existing stack: Next.js App Router (`web/`), Supabase auth/Postgres, Vitest, Playwright.
- MCP endpoint: `/api/integrations/chatgpt/mcp`, stateless Streamable HTTP with a single write tool.
- OAuth endpoints: `/api/integrations/chatgpt/oauth/{register,authorize,consent,token}` plus `/.well-known/oauth-authorization-server` and protected-resource metadata.
- Consent page: `/integrations/chatgpt/authorize?request=<opaque-request-id>`.
- Settings endpoint: `GET /api/integrations/chatgpt/credentials` for non-secret metadata, `DELETE` to disconnect. **No user-facing key generation endpoint.**
- Save implementation: `/api/integrations/chatgpt/applications` handler, called internally by MCP with the OAuth bearer token. Identity is derived from the token, never accepted as a job field.
- Supabase migrations: `20240101000051_chatgpt_integration.sql` for hashed credentials and transactional saves; `20240101000052_chatgpt_oauth.sql` for OAuth clients, requests, and code exchange; `20240101000053_chatgpt_application_metadata.sql` to save all supported user-editable application metadata.
- Tokens are cryptographically random, stored only as hashes, scoped to saving jobs, expiring and revocable. OAuth authorization codes are short-lived, one-use, bound to client, redirect URI, PKCE, and MCP resource.
- Initial implementation has one active connection per Jobnest account. Reconnecting replaces the previous token. Token lifetime and response `expires_in` must match; no unsupported refresh grant should be advertised.
- Save fields: `request_id`, `company`, `position`, `applied_date`; optional `status`, `job_id`, `job_url`, `location`, `salary_range`, `notes`, `job_description`, `source`, `ats_provider`, `requires_sponsorship`, `company_tier`, and `glassdoor_rating`. Instructions require the complete job description available in the chat, up to 20,000 characters, rather than a summary. Unknown optional values are omitted and never invented.
- Only job records are saved. This feature does not submit employer applications, upload resumes, read the job list, or expose unrelated account data.
- Use configured `NEXT_PUBLIC_APP_URL` for canonical public HTTPS URLs; never trust Host/forwarded headers to construct OAuth endpoints.
- No OpenAI API key or model API call is needed: ChatGPT performs extraction and invokes the plugin.
- Protocol compatibility: current MCP `2026-07-28` per-request metadata/`server/discover` and legacy `2025-11-25`, `2025-06-18`, `2025-03-26` initialization clients. Current requests validate mirrored method/name/version headers. [MCP versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- Duplicate detection is scoped to prior plugin request IDs/content hashes. Ordinary website records with the same company/title/date are not silently merged. A deleted record leaves a retry tombstone.

## Work checklist

`[x]` completed locally, `[ ]` pending release/acceptance work. Local checks do not imply deployment or a verified real ChatGPT connection.

### 1. Research and planning

- [x] Inspect existing authentication, settings, validation, rate limiting, tests, and job schema.
- [x] Read current official OpenAI docs for GPT Actions versus modern plugins.
- [x] Adopt MCP + OAuth after the user's correction.
- [x] Save this plan and continuation instructions.

### 2. Database and save service — complete locally

- [x] Add service-role-only credential table; revoke public/anonymous/authenticated access; enable RLS.
- [x] Implement random bearer tokens with hashed storage, expiry, status metadata, and disconnect.
- [x] Implement transactional save RPC with token/account checks and account isolation.
- [x] Prevent duplicate saves with per-account transaction locks; reject reused request IDs with changed contents. Multi-connection contention still needs hosted/staging validation.
- [x] Validate required fields, real dates, lengths, safe URLs, unknown fields, JSON, and payload byte size.
- [x] Add rate limits and safe no-store responses; never expose raw tokens in logs or status APIs.
- [x] Check blocked/deleted/deactivated account behavior and revalidate credentials after acquiring the database lock.
- [x] Save every supported user-editable application field available in the chat, including the complete job description, portal, sponsorship, tier, and rating.

### 3. OAuth connection — complete locally

- [x] Add authorization server and MCP protected-resource discovery metadata.
- [x] Implement dynamic public-client registration with strict redirect URI handling.
- [x] Validate authorization parameters, resource, scope, state, and S256 PKCE.
- [x] Require authenticated explicit consent; no automatic approvals.
- [x] Exchange one-use authorization code atomically for the scoped bearer token.
- [x] Preserve the consent request through password login and social OAuth login; validate return paths to prevent external redirects.
- [x] Ensure unsupported grants, expired/replayed codes, wrong verifier/client/resource/redirect fail safely.

### 4. MCP server — complete locally

- [x] Implement server/discover, initialize, ping, legacy notifications, tools/list, and tools/call with version-appropriate JSON-RPC envelopes.
- [x] Advertise one `save_job_application` tool with OAuth security metadata and correct write/idempotency annotations.
- [x] Publish input schema from the same Zod schema used for backend validation.
- [x] Validate Origin, protocol version, request content type, body size, and current protocol header/body agreement.
- [x] Return OAuth discovery challenges for missing/invalid/expired credentials.
- [x] Return structured results and readable errors; never claim success after a failed save.
- [x] Make only the exact required integration/OAuth URLs bypass the cookie-only proxy gate; their handlers enforce authentication.

### 5. Settings and consent UI — implemented; live visual acceptance pending

- [x] Add plugin setup card to Account Settings with current ChatGPT steps and copyable MCP URL, plus a top-of-page setup shortcut.
- [x] Show connection/loading/error/expired states and last successful save separately.
- [x] Add refresh status and disconnect control.
- [x] Build consent page identifying the requesting client, callback host, account, permission, and Connect/Cancel decision.
- [x] Explain enabled-plugin requirement, developer mode availability, and public HTTPS requirement.
- [x] Remove abandoned custom GPT/OpenAPI/API-key UI.
- [ ] Check responsive layout, labels, keyboard controls, and clipboard failure feedback.

### 6. Verification and delivery

- [x] Install repository dependencies without changing package/lock versions.
- [x] Run relevant Vitest security/route tests and existing proxy/auth regressions: 219 tests passed.
- [x] Run TypeScript and targeted lint checks; production build passed.
- [x] Execute both new migrations in isolated PostgreSQL via PGlite: 13 database checks passed. Existing Supabase tables use minimal fixtures; hosted triggers/API/concurrent connections remain separate.
- [x] Verify current/legacy MCP discovery, handshake, metadata, authentication and tool behavior through protocol tests; HTTP smoke checks also pass against the built Next.js server.
- [ ] Exercise a connected test account: sign in → consent → token → save → retry → disconnect → denied save.
- [ ] Verify Settings/consent in browser when a usable local authenticated environment is available.
- [x] Record exact checks and limitations in this file.
- [x] Add [deploy/configuration instructions](CHATGPT_PLUGIN_SETUP.md) and a README link.
- [ ] Apply migrations and deploy only when deployment credentials/environment and authorization are available. Do not imply local changes are live.
- [ ] Test the deployed HTTPS endpoint from ChatGPT. Public plugin directory submission is a separate optional release task.

## Current handoff snapshot

The local implementation is written and validated. Do not start it again from scratch:

- `web/lib/chatgpt/{schema,setup,credentials,oauth}.ts`: shared validation/schema, instructions/configuration, token authentication, OAuth logic.
- `web/app/api/integrations/chatgpt/`: MCP transport, save handler, connection status/disconnect, and OAuth endpoints.
- `web/app/.well-known/`: authorization-server and protected-resource discovery.
- `web/components/profile/chatgpt-integration.tsx`: current plugin settings card; profile page mounts it and profile header links to it.
- `web/components/profile/chatgpt-authorize.tsx` and `web/app/integrations/chatgpt/authorize/page.tsx`: signed-in consent screen.
- `web/lib/auth/redirect.ts`, login page, auth callback, and proxy: preserve and validate consent return paths.
- Migrations 51/52/53: credential/save tables/functions, OAuth request/code exchange, and complete supported application metadata.
- `web/tests/unit/api/chatgpt/`, `web/tests/unit/api/chatgpt-oauth.test.ts`, `web/tests/unit/lib/chatgpt/`, and proxy tests: security, protocol, and auth regression coverage.
- `supabase/tests/chatgpt-integration.mjs`: executable isolated PostgreSQL checks.
- `web/tests/smoke/chatgpt.mjs`: unauthenticated HTTP discovery/guard/login-return checks, without writing user data.

No migration has been applied to hosted Supabase and no app has been deployed. The full build used synthetic environment values to avoid writing real user data. The initial sandboxed build failed to download existing Google Fonts; rerunning with approved network access passed. The dependency install succeeded on resumption without package/lock changes. `npm.ps1` is blocked by Windows execution policy; use **`npm.cmd`**.

The feature entered `main` through PR #223. Follow-up commit `60d81aa` fixed TruffleHog URI-fixture false positives and made OAuth dynamic client registration compatible with ChatGPT metadata. Commit `e30f4c2` clarified ChatGPT write-action/App permissions and requires a plain `job_url` rather than Markdown link syntax. Both commits are on `origin/main`.

The current local, uncommitted change addresses the next live test: ChatGPT saved only a short job-description summary and skipped other available metadata. The MCP schema and instructions now require every supported field explicitly present in the conversation and the complete available job description up to 20,000 characters. Migration 53 extends the transactional save to `ats_provider`, `requires_sponsorship`, `company_tier`, and `glassdoor_rating`, and returns all saved fields. Unknown optional values remain omitted rather than guessed. Targeted tests currently pass: 89 Vitest tests, TypeScript, targeted ESLint, and 13 isolated PostgreSQL checks.

Remaining release work is explicit: run migrations on a staging/hosted project, configure the canonical production URL, deploy, verify Settings/consent on desktop/mobile, and connect actual ChatGPT test accounts. The local Playwright browser binary was not installed, so no authenticated browser visual check is claimed. The new database behavior has been executed in isolated PostgreSQL, but real Supabase auth/PostgREST and existing triggers need staging acceptance.

## How another AI should continue

1. Read this file and the user's latest messages. Preserve the modern-plugin decision.
2. Run `git status --short` and inspect all changed/new integration files. Do not discard in-progress work or assume unchecked work is absent.
3. Inspect any local instructions before editing. Workspace: `C:\Users\ompat\Documents\GitHub\Jobnest`; frontend commands run in `web` with `npm.cmd`.
4. Continue with the unchecked release/acceptance tasks; the core schema, database, OAuth, MCP, and UI/login code are already implemented.
5. Keep OAuth, MCP, and UI endpoint names/response shapes synchronized. Validate migrations before promising functional integration.
6. Run checks and record actual results below, including failures and environmental blockers. Mocked Supabase tests do not prove the SQL runs.
7. Update the checklist and snapshot after each completed stage and before ending a session. Never put real secrets in this document.

## Verification log

| Check | Result |
| --- | --- |
| Official research | Complete; sources above |
| Initial git status | Clean before this feature |
| Dependency install | Passed `npm.cmd ci --no-audit --no-fund`; existing peer dependency warnings only |
| Relevant unit / auth regression tests | 219 tests passed across 9 files |
| Typecheck | Passed `npm.cmd run typecheck` |
| Targeted lint | Passed for integration routes/helpers/UI, login/callback/proxy and tests |
| Production build | Passed after permitting existing Google Fonts downloads; synthetic test environment, no deployment |
| PostgreSQL migration checks | 13 passed using actual migration SQL in isolated PGlite; minimal fixtures for pre-existing tables |
| Built-server HTTP smoke | Passed discovery, OAuth challenge, cookie-protected JSON responses, consent login return |
| TruffleHog CI follow-up | Zero verified secrets in the failed run; the URI-fixture false positives and unsupported workflow input were fixed in `60d81aa` on `main`. |
| Live ChatGPT DCR follow-up | Deployed discovery verified; metadata normalization is committed on `main`; 48 OAuth tests, typecheck, and targeted ESLint passed before delivery. A post-deployment connector retry is still required. |
| Complete chat extraction follow-up | Local and uncommitted; 89 targeted Vitest tests, TypeScript, targeted ESLint, and 13 PostgreSQL checks pass. Full 20,000-character job descriptions are preserved. |
| Authenticated browser / live ChatGPT / hosted Supabase | Not run; release acceptance still required |
| Deployment | Not performed |
