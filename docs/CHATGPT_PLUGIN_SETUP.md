# Deploy and connect the Jobnest ChatGPT plugin

This integration is a personal ChatGPT plugin backed by an authenticated MCP server. Users sign in to Jobnest through OAuth; no OpenAI API key or copied Jobnest API key is required. The plugin can create job records and return the result of that save. It cannot read the job list, edit/delete jobs, or access documents.

See [the implementation checklist and handoff](CHATGPT_PLUGIN_PLAN.md) for completed checks and remaining release work.

## Operator setup

1. Apply the existing Supabase migrations in order, followed by:
   - `supabase/migrations/20240101000051_chatgpt_integration.sql`
   - `supabase/migrations/20240101000052_chatgpt_oauth.sql`
   - `supabase/migrations/20240101000053_chatgpt_application_metadata.sql`
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
4. Sign into Jobnest when prompted. The consent page shows the requesting app, return host, account, and **Save job applications** permission. Select **Connect**.
5. Install the resulting personal plugin. Open the Jobnest connection settings and ensure its **Actions** control permits `save_job_application`. Choose an **App permissions** option that allows changes. A Business or Enterprise workspace administrator may need to approve this write action.
6. Start a new ChatGPT conversation and add Jobnest from the tools menu or select **@Jobnest**.
7. After applying to the job discussed in the conversation, type **JOBNEST**. ChatGPT asks for missing company, title, or application date, then sends the structured details. Approve any ChatGPT save confirmation and wait for a Jobnest record link.
8. Refresh connection status in Jobnest to see the last successful save. **Disconnect ChatGPT** revokes the token while preserving saved jobs.

Typing JOBNEST in an ordinary conversation without the enabled plugin cannot invoke Jobnest. Plugin/Developer mode availability may depend on account and workspace policy. A public directory listing is a separate submission/review process; this implementation does not create one.

If ChatGPT says the conversation does not permit the Jobnest connector action, no save request reached Jobnest. Add Jobnest to that conversation and check the connection's **Actions** and **App permissions**. Managed workspaces can restrict write actions even when the plugin itself is installed.

Official sources: [plugin quickstart](https://developers.openai.com/plugins/quickstart), [authentication](https://developers.openai.com/plugins/build/auth), [connection testing](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## Connection behavior

- The only tool is `save_job_application`. Required inputs are `request_id`, `company`, `position`, and `applied_date` (`YYYY-MM-DD`). It extracts every supported field present in the conversation: status, job/posting ID, plain job URL, salary, location/work arrangement, notes, the complete job description (up to 20,000 characters), source, application portal, sponsorship requirement, user-assigned company tier, and an explicitly provided Glassdoor rating. Unknown optional fields are omitted rather than invented.
- The full job description should be included whenever it appeared in the chat. Preserve responsibilities, qualifications, skills, experience, education, benefits, employment type, schedule, and employer details instead of replacing them with a short summary. Details without dedicated fields belong in notes.
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

That script executes the real new migrations against an in-memory Postgres database with minimal fixtures for existing Supabase tables. It tests permissions, ownership, PKCE/code reuse, expiry, duplicate saves, and disconnects. It does not test the hosted Supabase HTTP layer, all pre-existing triggers, or contention across real database connections.

Release acceptance should cover two independent Jobnest accounts, a signed-out password login, a social login, cancelled consent, successful save, a repeated save, an expired connection, and a save after disconnect. Verify desktop and mobile Settings/consent layouts against the deployed app.

## Operations

Retain registered OAuth clients while their connections exist. Expired/consumed `chatgpt_oauth_requests` can be purged periodically after both `expires_at` and any `code_expires_at` are older than one day. Keep `chatgpt_application_requests` while the user exists because those rows prevent replay duplication and preserve deletion tombstones. Account deletion cascades through the integration's user-owned rows.

Troubleshooting:

- **503 / setup unavailable:** check the canonical HTTPS environment variable and migrations.
- **401 / reconnect:** token expired, was replaced/disconnected, has the wrong audience/scope, or the account was disabled.
- **Invalid request/code:** restart the connection from ChatGPT; do not retry a consumed consent decision or code exchange.
- **403 in Settings:** the browser origin must match the canonical app origin.
- **429:** wait before retrying; reuse the same save request ID and details.
- **Validation error:** correct the identified fields; never tell the user a failed save succeeded.
