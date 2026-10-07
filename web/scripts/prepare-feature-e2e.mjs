// Creates one dedicated account, then keeps its credentials in ignored .env.local.
// Never prints credentials or sends email. Run from web/.
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  console.log('Supabase target:', new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin);
  if (process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD) {
    console.log('Dedicated E2E credentials already configured; no account created.');
    return;
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `jobnest-e2e-${Date.now()}-${randomBytes(4).toString('hex')}@example.com`;
  const password = `E2e!${randomBytes(24).toString('base64url')}`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: 'Jobnest E2E Test', onboarding_completed: true },
  });
  if (error) throw new Error(`Test account creation failed: ${error.message}`);
  try {
    fs.appendFileSync('.env.local', `\n# Dedicated feature E2E account (never commit)\nE2E_TEST_EMAIL=${email}\nE2E_TEST_PASSWORD=${password}\n`);
  } catch (error) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw error;
  }
  console.log('Dedicated E2E account created; credentials saved to ignored .env.local.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
