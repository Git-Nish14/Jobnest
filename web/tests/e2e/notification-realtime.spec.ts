import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { featureUserId, loginFeatureAccount } from './helpers/feature-account';

test('notification INSERT increments the badge over Realtime without reloading', async ({ page }) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to seed a notification.');
  const userId = await featureUserId();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  let subscribed = false;
  const id = randomUUID();
  let receivedInsert = false;
  page.on('websocket', socket => socket.on('framereceived', frame => {
    try {
      const raw = JSON.parse(String(frame.payload));
      // realtime-js defaults to Phoenix v2 tuples; also support v1 objects.
      const message = Array.isArray(raw) ? { topic: raw[2], event: raw[3], payload: raw[4] } : raw;
      if (message.topic === `realtime:notif-bell-${userId}` && message.event === 'phx_reply'
        && message.payload?.status === 'ok' && message.payload?.response?.postgres_changes?.length) subscribed = true;
      if (message.topic === `realtime:notif-bell-${userId}` && message.event === 'postgres_changes'
        && message.payload?.data?.type === 'INSERT' && message.payload?.data?.record?.id === id) receivedInsert = true;
    } catch { /* Ignore protocol heartbeats and non-JSON frames. */ }
  }));
  await loginFeatureAccount(page);
  await expect.poll(() => subscribed, { timeout: 15_000,
    message: 'Bell must subscribe before insertion; apply migration 055 if Realtime is not enabled.' }).toBe(true);
  const response = await page.request.get('/api/notifications/count');
  expect(response.ok()).toBe(true);
  const baseline = await response.json() as { total: number; unreadNotifications: number };
  const bell = page.getByRole('button', { name: /notification.*(?:click to view|no new alerts)/i });
  const badge = bell.locator('span[aria-hidden="true"]');
  const badgeText = (count: number) => count > 99 ? '99+' : String(count);
  if (baseline.total) await expect(badge).toHaveText(badgeText(baseline.total));
  else await expect(badge).toHaveCount(0);
  // An object stored only in this document disappears if it reloads.
  const marker = randomUUID();
  await page.evaluate(value => { Object.assign(window, { __e2eDocumentMarker: value }); }, marker);
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  try {
    const { error } = await admin.from('notifications').insert({
      id, user_id: userId, type: 'system', title: `[E2E] Realtime ${id}`, is_read: false,
    });
    expect(error, 'Notification insert must succeed').toBeNull();
    await expect.poll(() => receivedInsert, { timeout: 10_000,
      message: 'Database must publish this INSERT over WebSocket; apply migration 055.' }).toBe(true);
    await expect(badge).toHaveText(badgeText(baseline.total + 1), { timeout: 10_000 });
    await expect(bell).toHaveAttribute('aria-label', new RegExp(`^${baseline.total + 1} notification`));
    await bell.click();
    await expect(page.getByRole('link', { name: new RegExp(`${baseline.unreadNotifications + 1} unread notification`) })).toBeVisible();
    await page.getByRole('button', { name: 'Close notifications' }).click();
    // Read updates reconcile the count too.
    const update = await admin.from('notifications').update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', userId);
    expect(update.error).toBeNull();
    if (baseline.total) await expect(badge).toHaveText(badgeText(baseline.total), { timeout: 10_000 });
    else await expect(badge).toHaveCount(0, { timeout: 10_000 });
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__e2eDocumentMarker)).toBe(marker);
    expect(navigations, 'Badge changes must not navigate or reload').toBe(0);
  } finally {
    const { error } = await admin.from('notifications').delete().eq('id', id).eq('user_id', userId);
    expect(error, 'Remove only this test notification').toBeNull();
  }
});
