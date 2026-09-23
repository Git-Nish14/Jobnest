# Jobnest ChatGPT plugin — implementation plan and handoff

Last updated: 2026-09-23. Status: **duplicate checking and post-JOBNEST research are implemented locally; targeted unit, TypeScript, lint, and PostgreSQL checks pass. Hosted migration/deployment and live ChatGPT acceptance remain.**

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
5. Sign into Jobnest in the browser. Review and approve permission to check for a matching application and save job applications.
6. Install the personal plugin. For a ChatGPT folder/project, paste `@Jobnest Keep Jobnest available in this chat. Do not save anything yet. I will say JOBNEST only after I actually apply.` at the top of its instructions. For a normal chat, select `@Jobnest`.
7. Tailor a resume and, after actually applying, type JOBNEST. Before that trigger, ChatGPT does no Jobnest research, duplicate check, Jobnest-specific questioning, or save. After the trigger it uses chat context and public research to fill verified details, then calls `check_existing_application` with the company, role, and location.
8. If a matching application exists, ChatGPT warns the user and does not create another record unless the user confirms it is a different requisition. Otherwise it calls `save_job_application`, defaults status to Applied and the date to today, always attaches the URL, location, and description, and returns the Jobnest link. It asks for a URL or location only when it cannot recover one after research.
9. Settings shows connection status and last successful save. Disconnect revokes access.

## Architecture and boundaries

- Existing stack: Next.js App Router (`web/`), Supabase auth/Postgres, Vitest, Playwright.
- MCP endpoint: `/api/integrations/chatgpt/mcp`, stateless Streamable HTTP with one limited read tool and one write tool.
- OAuth endpoints: `/api/integrations/chatgpt/oauth/{register,authorize,consent,token}` plus `/.well-known/oauth-authorization-server` and protected-resource metadata.
- Consent page: `/integrations/chatgpt/authorize?request=<opaque-request-id>`.
- Settings endpoint: `GET /api/integrations/chatgpt/credentials` for non-secret metadata, `DELETE` to disconnect. **No user-facing key generation endpoint.**
- Save implementation: `/api/integrations/chatgpt/applications`; duplicate check: `/api/integrations/chatgpt/applications/check`. MCP calls both handlers internally with the OAuth bearer token. Identity is derived from the token, never accepted as a job field.
- Supabase migrations: `20240101000051_chatgpt_integration.sql` for hashed credentials and transactional saves; `20240101000052_chatgpt_oauth.sql` for OAuth clients, requests, and code exchange; `20240101000053_chatgpt_application_metadata.sql` for all supported application metadata; `20240101000054_chatgpt_duplicate_check.sql` for the account-scoped match query and expanded consent.
- Tokens are cryptographically random, stored only as hashes, scoped to `applications:read applications:write`, expiring and revocable. Migration 54 revokes previous write-only connections so users must reconnect and explicitly approve the read permission. OAuth authorization codes are short-lived, one-use, bound to client, redirect URI, PKCE, and MCP resource.
- Initial implementation has one active connection per Jobnest account. Reconnecting replaces the previous token. Token lifetime and response `expires_in` must match; no unsupported refresh grant should be advertised.
- Save fields: required `request_id`, `company`, `position`, `job_url`, `location`, and `job_description`; `applied_date` defaults to today and `status` to Applied; optional `job_id`, `salary_range`, `notes`, `source`, `ats_provider`, `requires_sponsorship`, `company_tier`, and `glassdoor_rating`. The complete job description from chat or the exact researched posting is used up to 20,000 characters. If original text remains unavailable, ChatGPT writes a detailed description from verified facts and prefixes `Generated from available information:`.
- Research starts only after JOBNEST. Prefer the exact employer/ATS posting, then the company site, then reputable job platforms. Use facts only when the source clearly matches the same company/title/location/requisition. Never invent salary, ID, location, work arrangement, sponsorship, benefits, rating, dates, or requirements. Put concise source URLs and supported facts in notes; omit unknown optional values.
- Only job records are checked/saved. The read tool returns at most one minimal record matching the normalized company, role, and location. It cannot list applications, and the feature does not submit employer applications, upload resumes, edit jobs, or expose unrelated account data.
- Use configured `NEXT_PUBLIC_APP_URL` for canonical public HTTPS URLs; never trust Host/forwarded headers to construct OAuth endpoints.
- No OpenAI API key or model API call is needed: ChatGPT performs extraction and invokes the plugin.
- Protocol compatibility: current MCP `2026-07-28` per-request metadata/`server/discover` and legacy `2025-11-25`, `2025-06-18`, `2025-03-26` initialization clients. Current requests validate mirrored method/name/version headers. [MCP versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- Pre-save duplicate checking compares normalized company, title, and location across all of the connected user's applications. It returns one minimal match so ChatGPT can warn the user. Save idempotency remains scoped to prior plugin request IDs/content hashes, and a deleted record leaves a retry tombstone.

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
- [x] Add an account-scoped normalized company/title/location duplicate query that returns at most one minimal record.
- [x] Expand OAuth consent to read + write and force existing write-only connections to reconnect.

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
- [x] Advertise `check_existing_application` with read-only annotations and `save_job_application` with write/idempotency annotations.
- [x] Publish input schema from the same Zod schema used for backend validation.
- [x] Validate Origin, protocol version, request content type, body size, and current protocol header/body agreement.
- [x] Return OAuth discovery challenges for missing/invalid/expired credentials.
- [x] Return structured results and readable errors; never claim success after a failed save.
- [x] Make only the exact required integration/OAuth URLs bypass the cookie-only proxy gate; their handlers enforce authentication.
- [x] Gate research, duplicate checking, required-field questions, and saving behind the JOBNEST trigger only.
- [x] Supply a generic JSON field prototype without a real company/job example that could be copied into an empty chat.

### 5. Settings and consent UI — implemented; live visual acceptance pending

- [x] Add plugin setup card to Account Settings with current ChatGPT steps and copyable MCP URL, plus a top-of-page setup shortcut.
- [x] Show connection/loading/error/expired states and last successful save separately.
- [x] Add refresh status and disconnect control.
- [x] Build consent page identifying the requesting client, callback host, account, permission, and Connect/Cancel decision.
- [x] Explain enabled-plugin requirement, developer mode availability, and public HTTPS requirement.
- [x] Add a copyable `@Jobnest` folder/project instruction and tell users to place it above all other instructions.
- [x] Show existing users a one-time reconnect notice with removal/re-add fallback and both required action names.
- [x] Remove abandoned custom GPT/OpenAPI/API-key UI.
- [ ] Check responsive layout, labels, keyboard controls, and clipboard failure feedback.

### 6. Verification and delivery

- [x] Install repository dependencies without changing package/lock versions.
- [x] Run relevant Vitest security/route tests and existing proxy/auth regressions: 219 tests passed.
- [x] Run TypeScript and targeted lint checks; production build passed.
- [x] Execute migrations 51 through 54 in isolated PostgreSQL via PGlite: 15 database checks passed, including revocation of a pre-existing write-only connection. Existing Supabase tables use minimal fixtures; hosted triggers/API/concurrent connections remain separate.
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
- Migrations 51/52/53/54: credential/save tables/functions, OAuth request/code exchange, complete supported metadata, expanded consent, and the limited duplicate-check RPC.
- `web/tests/unit/api/chatgpt/`, `web/tests/unit/api/chatgpt-oauth.test.ts`, `web/tests/unit/lib/chatgpt/`, and proxy tests: security, protocol, and auth regression coverage.
- `supabase/tests/chatgpt-integration.mjs`: executable isolated PostgreSQL checks.
- `web/tests/smoke/chatgpt.mjs`: unauthenticated HTTP discovery/guard/login-return checks, without writing user data.

No migration has been applied to hosted Supabase and no app has been deployed. The full build used synthetic environment values to avoid writing real user data. The initial sandboxed build failed to download existing Google Fonts; rerunning with approved network access passed. The dependency install succeeded on resumption without package/lock changes. `npm.ps1` is blocked by Windows execution policy; use **`npm.cmd`**.

The feature entered `main` through PR #223. Follow-up commit `60d81aa` fixed TruffleHog URI-fixture false positives and made OAuth dynamic client registration compatible with ChatGPT metadata. Commit `e30f4c2` clarified ChatGPT write-action/App permissions and requires a plain `job_url` rather than Markdown link syntax. Both commits are on `origin/main`.

Complete metadata extraction and migration 53 were committed and pushed to `main` as `a4152e9`. Mandatory descriptions, JOBNEST defaults, the generic field prototype, and the folder instruction were committed as `feb42d8`; mandatory job URLs were committed as `0c242c9`. The current local, uncommitted follow-up adds post-JOBNEST research, required location, duplicate checking, read-and-write consent, and migration 54. It removes the concrete real-company example so an empty chat cannot accidentally reuse it.

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
| Relevant unit / auth regression tests | 255 tests passed across 10 files for ChatGPT routes, OAuth, schemas, proxy, and login flow |
| Typecheck | Passed `npm.cmd run typecheck` |
| Targeted lint | Passed for integration routes/helpers/UI, login/callback/proxy and tests |
| Production build | Passed after permitting existing Google Fonts downloads; synthetic test environment, no deployment |
| PostgreSQL migration checks | 15 passed using actual migrations 51 through 54 in isolated PGlite; includes old-connection revocation, normalized matching, audience checks, tenant isolation, and SQL privilege checks; minimal fixtures for pre-existing tables |
| Built-server HTTP smoke | Passed discovery, OAuth challenge, cookie-protected JSON responses, consent login return |
| TruffleHog CI follow-up | Zero verified secrets in the failed run; the URI-fixture false positives and unsupported workflow input were fixed in `60d81aa` on `main`. |
| Live ChatGPT DCR follow-up | Deployed discovery verified; metadata normalization is committed on `main`; 48 OAuth tests, typecheck, and targeted ESLint passed before delivery. A post-deployment connector retry is still required. |
| Complete chat extraction | Migration 53 and all supported metadata committed as `a4152e9`; 89 targeted Vitest tests and 13 PostgreSQL checks passed. Full 20,000-character descriptions are preserved. |
| Mandatory description and JOBNEST defaults | Committed as `feb42d8`; 95 targeted Vitest tests, TypeScript, and targeted ESLint passed. Description is required, JOBNEST uses Applied/today without confirmation questions, and Settings supplies a copyable folder/project instruction. |
| Mandatory job URL | Committed as `0c242c9`. ChatGPT must recover a plain HTTP(S) posting URL or ask the user for it before saving. |
| Post-JOBNEST research and duplicate check | Local and uncommitted; 255 targeted Vitest tests across 10 files, TypeScript, targeted ESLint, and 15 PostgreSQL checks pass. Research/check/save remain gated behind JOBNEST; matching reads return one minimal record. |
| Authenticated browser / live ChatGPT / hosted Supabase | Not run; release acceptance still required |
| Deployment | Not performed |
