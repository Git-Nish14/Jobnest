import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

export function requireFeatureAccount() {
  for (const key of ['E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    if (!process.env[key]) throw new Error(`Missing ${key}. See the root README's notification and DOCX feature test instructions.`);
  }
}

export async function loginFeatureAccount(page: Page) {
  requireFeatureAccount();
  await page.goto('/login');
  // The app's login UI requires an emailed OTP. These feature tests authenticate
  // with Supabase and install genuine SSR session cookies without sending mail.
  const cookies = new Map<string, string>();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false },
    cookies: {
      getAll: () => [],
      setAll: values => { for (const cookie of values) cookies.set(cookie.name, cookie.value); },
    },
  });
  const { error } = await client.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD!,
  });
  if (error) throw new Error('Dedicated E2E account login failed.');
  await page.context().addCookies(Array.from(cookies, ([name, value]) => ({
    name, value, url: new URL(page.url()).origin, sameSite: 'Lax' as const,
  })));
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard(?:[/?]|$)/, { timeout: 30_000 });
}

export async function featureUserId() {
  requireFeatureAccount();
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD!,
  });
  if (error || !data.user) throw new Error('Dedicated E2E account login failed.');
  const id = data.user.id;
  await client.auth.signOut({ scope: 'local' });
  return id;
}
