# Deploy and connect the Jobnest ChatGPT plugin

This integration is a personal ChatGPT plugin backed by an authenticated MCP server. Users sign in to Jobnest through OAuth; no OpenAI API key or copied Jobnest API key is required. After the user says **JOBNEST**, the plugin can check for one matching application and create a job record. It cannot list jobs, edit/delete jobs, or access documents.

See [the implementation checklist and handoff](CHATGPT_PLUGIN_PLAN.md) for completed checks and remaining release work.

## Operator setup

1. Apply the existing Supabase migrations in order, followed by:
   - `supabase/migrations/20240101000051_chatgpt_integration.sql`
   - `supabase/migrations/20240101000052_chatgpt_oauth.sql`
   - `supabase/migrations/20240101000053_chatgpt_application_metadata.sql`
   - `supabase/migrations/20240101000054_chatgpt_duplicate_check.sql`
   Migration 54 adds the limited duplicate-check permission and revokes existing ChatGPT credentials and pending OAuth requests. Existing users must reconnect so they can explicitly approve the expanded read-and-write scope.
2. Configure the web deployment with its existing Supabase authentication settings and `SUPABASE_SERVICE_ROLE_KEY` on the server only. Set `NEXT_PUBLIC_APP_URL` to the canonical public HTTPS origin, such as `https://jobnest.your-domain.com`. It must match the origin users visit, with no subpath, query, credentials, or nonstandard port. Rebuild after changing it because Settings also uses it in the browser bundle.
3. Keep the app's existing `CSRF_SECRET` and other required environment variables. Ensure the Supabase Auth redirect allowlist permits the app's `/auth/callback` return URL including its `next` query parameter, and verify that social sign-in returns to consent. Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for distributed OAuth/protocol rate limiting. Saving jobs also has a database-enforced limit of 60 requests per account per minute.
4. Build and deploy `web/` using the project's usual Next.js deployment. Keep the MCP and OAuth endpoints publicly reachable; deployment-password screens or a CDN cookie gate will prevent ChatGPT from connecting. Endpoint authentication still protects access to accounts.
5. Confirm `GET /.well-known/oauth-authorization-server` and `GET /.well-known/oauth-protected-resource/api/integrations/chatgpt/mcp` return JSON with the canonical HTTPS origin. An unauthenticated MCP request should return HTTP 401 with a `WWW-Authenticate` resource metadata URL, not a redirect to Jobnest's login page.
6. Test a real ChatGPT connection using the steps below before releasing the feature. Local test success is not a hosted ChatGPT acceptance test.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to ChatGPT, user settings, URLs, logs, or client-side environment variables.

## User setup

1. Open **Jobnest → Account Settings → Set up ChatGPT plugin** and copy the MCP URL.
2. In ChatGPT, enable **Settings → Security and login → Developer mode**, if available for the account/workspace.
3. Open **Plugins**, choose the add (+) option, name the plugin **Jobnest**, and enter the MCP URL. Select **OAuth** with automatic discovery/dynamic registration. Jobnest publishes public-client authentication (`none`); no shared client secret is needed.
4. Sign into Jobnest when prompted. The consent page shows the requesting app, return host, account, and **Check and save job applications** permission. Select **Connect**.
5. Install the resulting personal plugin. Open the Jobnest connection settings and permit the read-only `check_existing_application` action and the write `save_job_application` action. Choose an **App permissions** option that allows changes. A Business or Enterprise workspace administrator may need to approve these actions.
6. If you use a ChatGPT folder or project, paste the following line at the very top of its instructions, above all other instructions: `@Jobnest Keep Jobnest available in this chat. Do not save anything yet. I will say JOBNEST only after I actually apply.` This keeps the plugin available in folder chats without triggering an early save.
7. In a normal conversation, add Jobnest from the tools menu or select **@Jobnest**.
8. After applying to the job discussed in the conversation, type **JOBNEST**. Until that trigger, ChatGPT must not perform Jobnest research, ask Jobnest-specific questions, check your records, or save anything. After the trigger, it uses the conversation and available web search to recover supported public facts, then checks the exact company, role, and location. If a match exists, it warns you and does not save another record unless you confirm this is a different requisition. Otherwise it saves as **Applied** with today's date without asking whether or when you applied. If the posting URL or location remains unknown, ChatGPT asks you for it before saving. Approve any ChatGPT action prompt and wait for a Jobnest record link.
9. Refresh connection status in Jobnest to see the last successful save. **Disconnect ChatGPT** revokes the token while preserving saved jobs.

Typing JOBNEST in an ordinary conversation without the enabled plugin cannot invoke Jobnest. Plugin/Developer mode availability may depend on account and workspace policy. A public directory listing is a separate submission/review process; this implementation does not create one.

If ChatGPT says the conversation does not permit the Jobnest connector action, no request reached Jobnest. Add Jobnest to that conversation and check both actions under the connection's **Actions** and **App permissions**. Managed workspaces can restrict actions even when the plugin itself is installed.

Official sources: [plugin quickstart](https://developers.openai.com/plugins/quickstart), [authentication](https://developers.openai.com/plugins/build/auth), [connection testing](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## Connection behavior

- Jobnest exposes two tools. `check_existing_application` is read-only and accepts only company, position, and location. It returns either no match or one minimal matching record; it cannot list the user's applications. `save_job_application` creates the record.
- Saving requires `request_id`, `company`, `position`, `job_url`, `location`, and `job_description`. `applied_date` defaults to today and `status` defaults to `Applied`. The job URL must be a plain HTTP(S) posting URL. ChatGPT asks the user for a missing URL or location after research. It fills other supported fields when verified: job/posting ID, salary, notes, source, application portal, sponsorship restriction, company tier, and Glassdoor rating. `requires_sponsorship` is true only when verified evidence says the role does not sponsor visas or requires the user to supply work authorization.
- Research begins only after **JOBNEST**. ChatGPT prefers the exact employer/ATS posting, then the company site, then reputable job platforms. It uses a result only when the company, title, location, or requisition identifies the same job. It never guesses salary, job ID, location, work arrangement, sponsorship, benefits, rating, dates, or requirements. Unknown optional fields are omitted. Relevant research URLs and the facts they support go in notes.
- A non-empty job description is attached to every save. ChatGPT uses the full posting text from the conversation or exact researched posting, preserving responsibilities, qualifications, skills, experience, education, benefits, employment type, schedule, and employer details up to 20,000 characters. If the posting text remains unavailable, it creates a detailed description using only verified facts and starts it with `Generated from available information:`. Details without dedicated fields belong in notes.
- MCP instructions include a generic field prototype and the limits and enum rules for every field. It contains no real company or job values and explicitly cannot be used as job data when the chat contains no real job.
- A repeated request ID and identical normalized details returns the same application. Reusing that ID with different details returns a conflict. Identical prior plugin submissions also deduplicate if a model generates another ID. Different job details are not silently merged with ordinary website records.
- Deleting a saved job leaves an idempotency tombstone: retrying the original request does not recreate a deleted record.
- Jobnest determines ownership from the token. A payload cannot specify a user ID.
- Authorization requests expire in 10 minutes, approved authorization codes in 5 minutes, and access tokens in 365 days. Codes are single use; reconnect when a token expires. Refresh-token grants are not advertised or supported.
- There is one active connection per Jobnest account. Reconnecting replaces the prior token. Disconnecting also invalidates pending consent requests/codes already bound to that account.
- The server supports current MCP `2026-07-28` per-request metadata and `server/discover`, as well as legacy `initialize` clients on `2025-11-25`, `2025-06-18`, and `2025-03-26`. It uses JSON Streamable HTTP responses without sessions, SSE subscriptions, or custom UI resources.
- The configured public origin is also the token audience. Changing domains requires reconnecting users; old-domain tokens are rejected.

## Checks for future changes

From `web/` on Windows (use `npm` on other platforms):

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run typecheck
npm.cmd test -- tests/unit/api/chatgpt tests/unit/api/chatgpt-oauth.test.ts tests/unit/lib/chatgpt tests/unit/proxy.test.ts tests/flows/auth/login-flow.test.ts
npm.cmd run build
```

With the built app running, check public routing without creating user data:

```powershell
node tests/smoke/chatgpt.mjs http://127.0.0.1:3085
```

For isolated database checks, install the test-only PostgreSQL runtime outside the application dependencies, then run from the repository root:

```powershell
$validationDir = Join-Path $env:TEMP 'jobnest-chatgpt-validation'
npm.cmd install --prefix $validationDir --no-audit --no-fund --ignore-scripts @electric-sql/pglite
$env:PGLITE_MODULE_PATH = Join-Path $validationDir 'node_modules/@electric-sql/pglite/dist/index.js'
node supabase/tests/chatgpt-integration.mjs
```

That script executes the real new migrations against an in-memory Postgres database with minimal fixtures for existing Supabase tables. It tests permissions, ownership, PKCE/code reuse, expiry, duplicate saves, normalized duplicate checks, account isolation, and disconnects. It does not test the hosted Supabase HTTP layer, all pre-existing triggers, or contention across real database connections.

Release acceptance should cover two independent Jobnest accounts, a signed-out password login, a social login, cancelled consent, a matching and non-matching duplicate check, successful save, a repeated save, an expired connection, and a save after disconnect. Verify that ordinary job discussion performs no Jobnest action before **JOBNEST**, and verify desktop and mobile Settings/consent layouts against the deployed app.

## Operations

Retain registered OAuth clients while their connections exist. Expired/consumed `chatgpt_oauth_requests` can be purged periodically after both `expires_at` and any `code_expires_at` are older than one day. Keep `chatgpt_application_requests` while the user exists because those rows prevent replay duplication and preserve deletion tombstones. Account deletion cascades through the integration's user-owned rows.

Troubleshooting:

- **503 / setup unavailable:** check the canonical HTTPS environment variable and migrations.
- **401 / reconnect:** token expired, was replaced/disconnected, has the wrong audience/scope, or the account was disabled.
- **Invalid request/code:** restart the connection from ChatGPT; do not retry a consumed consent decision or code exchange.
- **403 in Settings:** the browser origin must match the canonical app origin.
- **429:** wait before retrying; reuse the same save request ID and details.
- **Validation error:** correct the identified fields; never tell the user a failed save succeeded.
