// Run against a running deployment: node tests/smoke/chatgpt.mjs http://127.0.0.1:3085
// Uses no credentials and creates no user data.
import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://127.0.0.1:3085";
const get = (path, init = {}) => fetch(new URL(path, base), { redirect: "manual", ...init });
const discoveryResponse = await get("/.well-known/oauth-authorization-server");
assert.equal(discoveryResponse.status, 200);
const discovery = await discoveryResponse.json();
assert.match(discovery.issuer, /^https:\/\//);
assert.deepEqual(discovery.token_endpoint_auth_methods_supported, ["none"]);
assert.deepEqual(discovery.code_challenge_methods_supported, ["S256"]);
assert.equal(discovery.authorization_response_iss_parameter_supported, true);

const resourcePath = "/.well-known/oauth-protected-resource/api/integrations/chatgpt/mcp";
const resourceResponse = await get(resourcePath);
assert.equal(resourceResponse.status, 200);
const resource = await resourceResponse.json();
assert.equal(resource.resource, `${discovery.issuer}/api/integrations/chatgpt/mcp`);
assert.deepEqual(resource.authorization_servers, [discovery.issuer]);

const challenge = await get("/api/integrations/chatgpt/mcp", {
  method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
assert.equal(challenge.status, 401);
assert.equal(challenge.headers.get("location"), null);
assert.ok(challenge.headers.get("www-authenticate").includes(`${discovery.issuer}${resourcePath}`));
assert.equal(challenge.headers.get("cache-control"), "no-store");
assert.equal((await get("/api/integrations/chatgpt/credentials")).status, 401);
assert.equal((await get(`/api/integrations/chatgpt/oauth/consent?request=${"a".repeat(43)}`)).status, 401);

const consentPath = `/integrations/chatgpt/authorize?request=${"a".repeat(43)}`;
const login = await get(consentPath);
assert.equal(login.status, 307);
const redirect = new URL(login.headers.get("location"), base);
assert.equal(redirect.pathname, "/login");
assert.equal(redirect.searchParams.get("redirect"), consentPath);
console.log("HTTP smoke passed: discovery, OAuth challenge, private JSON endpoints, and consent login return.");
