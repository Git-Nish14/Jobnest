/** Isolated PostgreSQL validation. No hosted database or user records are accessed. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
if (!process.env.PGLITE_MODULE_PATH) throw new Error("Set PGLITE_MODULE_PATH to the PGlite package entry");
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0].value;
const migration = async (name) => {
  try { await db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8")); }
  catch (error) { throw new Error(`${name}: ${error.message}`); }
};
let checks = 0;
const test = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}', banned_until timestamptz, deleted_at timestamptz);
    CREATE TYPE public.application_status AS ENUM ('Applied','Phone Screen','Interview','Offer','Rejected','Withdrawn','Ghosted');
    CREATE TYPE public.company_tier AS ENUM ('FAANG','Tier 1','Tier 2','Tier 3','Startup');
    CREATE TABLE public.job_applications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      company varchar(255) NOT NULL, position varchar(255) NOT NULL, status public.application_status NOT NULL,
      applied_date date NOT NULL, job_id varchar(100), job_url text, salary_range varchar(100), location varchar(255),
      notes text, job_description text, source text, ats_provider text, requires_sponsorship boolean NOT NULL DEFAULT false,
      company_tier public.company_tier, glassdoor_rating numeric(3,1), created_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.pending_deletions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id), cancelled_at timestamptz, deleted_at timestamptz);
    CREATE TABLE public.activity_logs(user_id uuid, application_id uuid, activity_type text, description text, metadata jsonb, created_at timestamptz DEFAULT now());
    CREATE TABLE public.document_purge_queue(application_id uuid, status text);
    INSERT INTO public.document_purge_queue VALUES(gen_random_uuid(), 'pending');
  `);
  for (const name of ["20240101000051_chatgpt_integration.sql", "20240101000052_chatgpt_oauth.sql", "20240101000053_chatgpt_application_metadata.sql", "20240101000054_chatgpt_duplicate_check.sql"]) await migration(name);
  await db.query("INSERT INTO auth.users(id,raw_user_meta_data) VALUES($1,'{\"timezone\":\"America/Chicago\"}'),($2,'{}')", [owner, other]);
  const token = createHash("sha256").update("test-token").digest("hex");
  await db.query("INSERT INTO chatgpt_credentials(user_id,key_hash,key_prefix,resource,scope) VALUES($1,$2,'jobnest_abcdef0','https://example.com/mcp','applications:read applications:write')", [owner, token]);
  for (const name of ["20240101000055_search_lifecycle.sql", "20240101000056_search_planning.sql", "20240101000057_chatgpt_search_lifecycle.sql"]) await migration(name);
  await db.exec(`CREATE TRIGGER application_activity_trigger AFTER INSERT OR UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.log_application_activity();`);
  await test("new migrations preserve an existing ChatGPT connection", async () => {
    assert.equal(await scalar("SELECT count(*)::int AS value FROM chatgpt_credentials WHERE key_hash=$1", [token]), 1);
  });
  await test("all lifecycle and planner migrations execute in committed order", async () => {
    assert.equal(await scalar("SELECT count(*)::int AS value FROM pg_enum WHERE enumlabel IN ('Saved','Preparing','Accepted')"), 3);
  });
  const role = (await db.query("INSERT INTO job_applications(user_id,company,position,status,applied_date) VALUES($1,'Acme','Engineer','Saved','2020-01-01') RETURNING id", [owner])).rows[0].id;
  await test("first submitted transition replaces a saved date using user-local today", async () => {
    await db.query("UPDATE job_applications SET status='Applied' WHERE id=$1", [role]);
    assert.equal(await scalar("SELECT applied_date = (current_timestamp AT TIME ZONE 'America/Chicago')::date AS value FROM job_applications WHERE id=$1", [role]), true);
    assert.equal(await scalar("SELECT submitted_at IS NOT NULL AND saved_date='2020-01-01' AS value FROM job_applications WHERE id=$1", [role]), true);
  });
  await test("changing later stages preserves submission date and records history", async () => {
    const original = await scalar("SELECT applied_date::text AS value FROM job_applications WHERE id=$1", [role]);
    await db.query("UPDATE job_applications SET status='Interview' WHERE id=$1", [role]);
    await db.query("UPDATE job_applications SET status='Rejected' WHERE id=$1", [role]);
    assert.equal(await scalar("SELECT applied_date::text AS value FROM job_applications WHERE id=$1", [role]), original);
    assert.equal(await scalar("SELECT count(*)::int AS value FROM activity_logs WHERE application_id=$1 AND metadata->>'new_status'='Interview'", [role]), 1);
  });
  await test("an explicitly edited historical submission date is retained", async () => {
    const id = (await db.query("INSERT INTO job_applications(user_id,company,position,status,applied_date) VALUES($1,'Acme','Designer','Preparing','2020-01-01') RETURNING id", [owner])).rows[0].id;
    await db.query("UPDATE job_applications SET status='Applied',applied_date='2026-09-01' WHERE id=$1", [id]);
    assert.equal(await scalar("SELECT applied_date::text AS value FROM job_applications WHERE id=$1", [id]), "2026-09-01");
  });
  await test("moving an old submitted role back through Saved does not overwrite its application date", async () => {
    const id = (await db.query("INSERT INTO job_applications(user_id,company,position,status,applied_date) VALUES($1,'Acme','Legacy','Applied','2020-01-01') RETURNING id", [owner])).rows[0].id;
    await db.query("UPDATE job_applications SET status='Saved' WHERE id=$1", [id]);
    await db.query("UPDATE job_applications SET status='Applied' WHERE id=$1", [id]);
    assert.equal(await scalar("SELECT applied_date::text AS value FROM job_applications WHERE id=$1", [id]), "2020-01-01");
  });
  await test("withdrawing a saved role does not record a submission", async () => {
    const id = (await db.query("INSERT INTO job_applications(user_id,company,position,status,applied_date) VALUES($1,'Acme','Analyst','Saved','2020-01-01') RETURNING id", [owner])).rows[0].id;
    await db.query("UPDATE job_applications SET status='Withdrawn' WHERE id=$1", [id]);
    assert.equal(await scalar("SELECT submitted_at IS NULL AS value FROM job_applications WHERE id=$1", [id]), true);
  });
  await test("previously queued document deletion is replaced with retention", async () => {
    assert.equal(await scalar("SELECT count(*)::int AS value FROM document_purge_queue WHERE status='pending'"), 0);
  });
  await db.exec("GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated; SET ROLE authenticated;");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [owner]);
  await db.query("INSERT INTO search_plan_tasks(user_id,week_start,task_key,status) VALUES($1,'2026-10-04','weekly-review','completed')", [owner]);
  await test("task state is visible only to its owner", async () => {
    assert.equal(await scalar("SELECT count(*)::int AS value FROM search_plan_tasks"), 1);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [other]);
    assert.equal(await scalar("SELECT count(*)::int AS value FROM search_plan_tasks"), 0);
  });
  await test("another user cannot forge task ownership", async () => {
    await assert.rejects(db.query("INSERT INTO search_plan_tasks(user_id,week_start,task_key) VALUES($1,'2026-10-04','outreach-1')", [owner]), /row-level security/i);
  });
  await db.exec("RESET ROLE");
  await test("ChatGPT saves support the same new lifecycle values", async () => {
    for (const status of ["Saved", "Preparing", "Accepted"]) {
      const payload = JSON.stringify({ company: "Acme", position: status, applied_date: "2026-10-01", status });
      const contentHash = createHash("sha256").update(payload).digest("hex");
      const result = await scalar("SELECT save_chatgpt_application($1,'https://example.com/mcp',$2,$3,$4::jsonb) AS value", [token, `request-${status}`, contentHash, payload]);
      assert.equal(result.error, undefined);
      assert.equal(result.application.status, status);
    }
  });
  console.log(`${checks} database checks passed`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await db.close(); }
