// Component/browser regressions complement the live database/storage E2E tests.
import { test, expect } from '@playwright/test';
import * as mammoth from 'mammoth';
import path from 'node:path';
import type { Route } from '@playwright/test';

test('an old count response cannot undo a Realtime increment', async ({ page }) => {
  const pending: Route[] = [];
  await page.route('**/api/notifications/count', route => { pending.push(route); });
  await page.goto('/notification-fixture');
  await expect.poll(() => pending.length).toBe(2); // initial fetch + subscription reconcile
  const reply = (route: Route, total: number) => route.fulfill({ json: {
    overdueReminders: 0, upcomingInterviews: 0, unreadNotifications: total, total,
  } });
  await reply(pending[1], 1);
  const bell = page.getByRole('button', { name: /notification.*click to view/i });
  const badge = bell.locator('span[aria-hidden="true"]');
  await expect(badge).toHaveText('1');
  await page.evaluate(() => window.__mobileRealtime.emit('INSERT', { is_read: false }));
  await expect(badge).toHaveText('2');
  await expect.poll(() => pending.length).toBe(3);
  const stale = page.waitForResponse('**/api/notifications/count');
  await reply(pending[0], 0);
  await (await stale).finished();
  // Wait for the fetch promise and React's following paint to settle.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(badge).toHaveText('2');
  await reply(pending[2], 2);
  await expect(badge).toHaveText('2');
});

test('DOCX without a signed URL renders, and its iframe blocks scripts and remote images', async ({ page }) => {
  const result = await mammoth.convertToHtml({ path: path.resolve('tests/e2e/fixtures/preview.docx') });
  let refreshRequests = 0;
  let remoteRequests = 0;
  await page.route('**/api/documents/refresh-url**', route => {
    refreshRequests++;
    return route.abort();
  });
  await page.route('https://preview-attacker.invalid/**', route => {
    remoteRequests++;
    return route.abort();
  });
  await page.route('**/api/documents/preview-html**', route => route.fulfill({ json: {
    html: result.value + '<script>document.body.dataset.executed="yes"</script>'
      + '<img src="https://preview-attacker.invalid/track" onerror="document.body.dataset.executed=\'yes\'">',
  } }));
  await page.goto('/docx-fixture');
  const iframe = page.getByRole('dialog').locator('iframe');
  await expect(iframe).toBeVisible();
  const content = iframe.contentFrame();
  await expect(content.getByRole('heading', { name: 'Jobnest DOCX Preview' })).toBeVisible();
  await expect(iframe).toHaveAttribute('sandbox', '');
  await expect(content.locator('body')).not.toHaveAttribute('data-executed', 'yes');
  await expect.poll(() => content.locator('img').evaluate(image => (image as HTMLImageElement).complete)).toBe(true);
  expect(refreshRequests, 'DOCX must not depend on signed-URL refresh').toBe(0);
  expect(remoteRequests, 'Preview CSP must block remote images before a request is sent').toBe(0);
});

test('failed DOCX conversion shows recovery actions instead of an endless spinner', async ({ page }) => {
  await page.route('**/api/documents/preview-html**', route => route.fulfill({ status: 500, json: { error: 'Conversion failed' } }));
  await page.goto('/docx-fixture');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Could not preview this document')).toBeVisible();
  await expect(dialog.locator('iframe')).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'Open in browser' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
});
