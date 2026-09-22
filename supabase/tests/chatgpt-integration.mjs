/**
 * Execute the real plugin migrations against isolated PostgreSQL (PGlite).
 * This creates an in-memory DB only; it never connects to hosted Supabase.
 * Install @electric-sql/pglite in a temporary directory, then set
 * PGLITE_MODULE_PATH to that package's dist/index.js and run this file.
 * Existing Supabase tables are minimal fixtures, not a full Supabase runtime.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

if (!process.env.PGLITE_MODULE_PATH) throw new Error("Set PGLITE_MODULE_PATH to @electric-sql/pglite/dist/index.js");
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const resource = "https://jobnest.example.com/api/integrations/chatgpt/mcp";
const callback = "https://chatgpt.com/connector_platform_oauth_redirect";
const client = `jobnest_client_${"a".repeat(32)}`;
const challenge = "c".repeat(43);
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function scalar(sql, params = []) { return (await db.query(sql, params)).rows[0].value; }
async function rpc(name, ...args) {
  return scalar(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`, args);
}
async function newRequest(label, owner = alice) {
  const requestHash = hash(`request:${label}`);
  await db.query(`insert into public.chatgpt_oauth_requests
    (request_hash,client_id,redirect_uri,state,code_challenge,resource,scope)
    values ($1,$2,$3,'state-to-preserve',$4,$5,'applications:write')`, [requestHash, client, callback, challenge, resource]);
  if (owner) assert.ok(await rpc("claim_chatgpt_oauth_request", requestHash, owner));
  return requestHash;
}
async function approvedCode(label, owner = alice) {
  const requestHash = await newRequest(label, owner);
  const codeHash = hash(`code:${label}`);
  assert.ok(await rpc("complete_chatgpt_oauth_consent", requestHash, owner, codeHash));
  return codeHash;
}
const exchange = (codeHash, overrides = {}) => rpc("exchange_chatgpt_oauth_code", codeHash,
  overrides.client ?? client, overrides.callback ?? callback, overrides.resource ?? resource,
  overrides.challenge ?? challenge, hash(overrides.token ?? "alice-token"), "jobnest_abcdef0");
const job = { company: "Acme", position: "Engineer", applied_date: "2026-09-22", status: "Applied", notes: "Applied after tailoring resume" };
const save = (token, requestId, details = job, audience = resource) => rpc("save_chatgpt_application",
  hash(token), audience, requestId, hash(JSON.stringify(details)), JSON.stringify(details));

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, banned_until timestamptz, deleted_at timestamptz);
    create table public.pending_deletions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), cancelled_at timestamptz, deleted_at timestamptz);
    create type public.application_status as enum ('Applied','Phone Screen','Interview','Offer','Rejected','Withdrawn','Ghosted');
    create table public.job_applications (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
      company varchar(255) not null, position varchar(255) not null, status public.application_status not null,
      applied_date date not null, job_id varchar(100), job_url text, salary_range varchar(100), location varchar(255),
      notes text, job_description text, source text, created_at timestamptz default now()
    );
  `);
  await test("migrations 51 and 52 execute unchanged", async () => {
    for (const filename of ["20240101000051_chatgpt_integration.sql", "20240101000052_chatgpt_oauth.sql"]) {
      await db.exec(await readFile(new URL(`../migrations/${filename}`, import.meta.url), "utf8"));
    }
  });
  await db.query("insert into auth.users(id) values ($1),($2)", [alice, bob]);
  await db.query("insert into public.chatgpt_oauth_clients(client_id,client_name,redirect_uris) values ($1,'ChatGPT',$2)", [client, [callback]]);

  await test("anonymous/browser roles cannot read token tables or invoke privileged functions", async () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["chatgpt_credentials", "chatgpt_application_requests", "chatgpt_oauth_clients", "chatgpt_oauth_requests"]) {
        assert.equal(await scalar("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') as value", [role, table]), false);
      }
      for (const signature of ["rotate_chatgpt_credential(uuid,text,text,text)", "revoke_chatgpt_credential(uuid)", "save_chatgpt_application(text,text,text,text,jsonb)", "claim_chatgpt_oauth_request(text,uuid)", "complete_chatgpt_oauth_consent(text,uuid,text)", "exchange_chatgpt_oauth_code(text,text,text,text,text,text,text)"]) {
        assert.equal(await scalar("select has_function_privilege($1,$2,'EXECUTE') as value", [role, signature]), false);
      }
    }
  });
  await test("consent is bound to the first signed-in account and cannot be replayed", async () => {
    const requestHash = await newRequest("ownership");
    assert.equal(await rpc("claim_chatgpt_oauth_request", requestHash, bob), null);
    assert.equal(await rpc("complete_chatgpt_oauth_consent", requestHash, bob, hash("wrong")), null);
    assert.ok(await rpc("complete_chatgpt_oauth_consent", requestHash, alice, null));
    assert.equal(await rpc("complete_chatgpt_oauth_consent", requestHash, alice, hash("late")), null);
  });
  await test("wrong PKCE, client, redirect, and resource cannot consume the code", async () => {
    const code = await approvedCode("checks");
    for (const overrides of [{ challenge: "wrong" }, { client: "wrong" }, { callback: "https://evil.example.com/cb" }, { resource: "https://other.example.com/mcp" }]) {
      assert.equal(await exchange(code, overrides), null);
    }
    const token = await exchange(code);
    assert.ok(token?.id);
    assert.equal(token.key_hash, undefined);
    assert.equal(await exchange(code), null);
    const stored = (await db.query("select * from public.chatgpt_credentials where user_id=$1", [alice])).rows[0];
    assert.equal(stored.key_hash, hash("alice-token"));
    assert.equal(stored.resource, resource);
    assert.equal(stored.scope, "applications:write");
  });
  await test("application writes derive account ownership and preserve actual job details", async () => {
    const result = await save("alice-token", "first");
    assert.equal(result.duplicate, false);
    assert.equal(result.application.company, "Acme");
    const stored = (await db.query("select * from public.job_applications where id=$1", [result.application.id])).rows[0];
    assert.equal(stored.user_id, alice);
    assert.equal(stored.notes, job.notes);
    assert.equal(stored.source, null);
    assert.ok(await scalar("select last_used_at is not null as value from public.chatgpt_credentials where user_id=$1", [alice]));
  });
  await test("retries are idempotent and changed request IDs cannot bypass content conflicts", async () => {
    const a = await save("alice-token", "first");
    const b = await save("alice-token", "new-id-same-payload");
    assert.equal(a.duplicate, true);
    assert.equal(b.application.id, a.application.id);
    assert.equal(b.duplicate, true);
    assert.equal((await save("alice-token", "first", { ...job, notes: "changed" })).error, "request_conflict");
    assert.equal(await scalar("select count(*)::integer as value from public.job_applications"), 1);
  });
  await test("another user can use the same request ID without reading or sharing Alice's record", async () => {
    await exchange(await approvedCode("bob", bob), { token: "bob-token" });
    const b = await save("bob-token", "first");
    assert.equal(b.duplicate, false);
    assert.equal(await scalar("select user_id::text as value from public.job_applications where id=$1", [b.application.id]), bob);
  });
  await test("invalid input, identity injection, and wrong token audience are rejected in SQL", async () => {
    for (const details of [{ ...job, applied_date: "2026-02-30" }, { ...job, user_id: bob }, { ...job, company: " " }, { ...job, job_url: "javascript:alert(1)" }]) {
      assert.equal((await save("alice-token", "invalid", details)).error, "invalid_application");
    }
    assert.equal((await save("alice-token", "audience", job, "https://other.example.com/mcp")).error, "invalid_key");
  });
  await test("deleting an application leaves a retry tombstone", async () => {
    const saved = await save("alice-token", "first");
    await db.query("delete from public.job_applications where id=$1", [saved.application.id]);
    assert.equal((await save("alice-token", "first")).error, "application_deleted");
  });
  await test("expired, banned, and deactivated accounts cannot save", async () => {
    await db.query("update public.chatgpt_credentials set expires_at=now()-interval '1 second' where user_id=$1", [alice]);
    assert.equal((await save("alice-token", "expired")).error, "invalid_key");
    await exchange(await approvedCode("fresh"), { token: "fresh-token" });
    await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1", [alice]);
    assert.equal((await save("fresh-token", "banned")).error, "invalid_key");
    await db.query("update auth.users set banned_until=null where id=$1", [alice]);
    await db.query("insert into public.pending_deletions(user_id) values ($1)", [alice]);
    assert.equal((await save("fresh-token", "deactivated")).error, "invalid_key");
    await db.query("delete from public.pending_deletions where user_id=$1", [alice]);
  });
  await test("expired codes and expired consent requests cannot be used", async () => {
    const code = await approvedCode("expired-code");
    await db.query("update public.chatgpt_oauth_requests set code_expires_at=now()-interval '1 second' where code_hash=$1", [code]);
    assert.equal(await exchange(code), null);
    const requestHash = await newRequest("expired-request");
    await db.query("update public.chatgpt_oauth_requests set created_at=now()-interval '20 minutes',expires_at=now()-interval '10 minutes' where request_hash=$1", [requestHash]);
    assert.equal(await rpc("claim_chatgpt_oauth_request", requestHash, alice), null);
  });
  await test("the database limits saves across server processes", async () => {
    await db.query("update public.chatgpt_credentials set rate_window_started_at=now(),rate_window_count=60 where user_id=$1", [alice]);
    assert.equal((await save("fresh-token", "rate-limit")).error, "rate_limited");
  });
  await test("disconnect revokes tokens and pending codes without deleting existing jobs", async () => {
    const pendingCode = await approvedCode("disconnect");
    const count = await scalar("select count(*)::integer as value from public.job_applications");
    await rpc("revoke_chatgpt_credential", alice);
    assert.equal((await save("fresh-token", "after-disconnect")).error, "invalid_key");
    assert.equal(await exchange(pendingCode), null);
    assert.equal(await scalar("select count(*)::integer as value from public.job_applications"), count);
    assert.equal((await save("bob-token", "first")).duplicate, true);
  });
  console.log(`${checks} PostgreSQL integration checks passed. Full hosted Supabase/concurrent multi-connection tests remain separate.`);
} finally {
  await db.close();
}
