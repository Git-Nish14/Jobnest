import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { loginFeatureAccount } from './helpers/feature-account';

test('real DOCX upload renders Mammoth HTML in the preview iframe', async ({ page }) => {
  await loginFeatureAccount(page);
  await page.goto('/documents');
  const label = `E2E DOCX ${randomUUID()}`;
  let documentId: string | undefined;
  try {
    await page.getByRole('button', { name: 'Add document' }).click();
    await page.getByPlaceholder('Label (e.g. Master Resume)').fill(label);
    const uploaded = page.waitForResponse(response => response.url().endsWith('/api/documents/upload')
      && response.request().method() === 'POST');
    await page.getByLabel('Upload document to library').setInputFiles(path.resolve('tests/e2e/fixtures/preview.docx'));
    const response = await uploaded;
    expect(response.status(), 'Real upload must pass MIME, magic bytes, storage, and database checks').toBe(201);
    const result = await response.json() as { document: { id: string; storage_path: string } };
    documentId = result.document.id;
    const card = page.locator('.db-content-card').filter({ has: page.getByText(label, { exact: true }) });
    await expect(card).toBeVisible();
    const converted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/documents/preview-html');
    await card.getByRole('button', { name: 'Preview', exact: true }).click();
    expect((await converted).status()).toBe(200);
    const dialog = page.getByRole('dialog', { name: label });
    await expect(dialog).toBeVisible();
    const iframe = dialog.locator('iframe');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('sandbox', '');
    await expect(iframe).toHaveAttribute('title', label);
    const content = iframe.contentFrame();
    await expect(content.getByRole('heading', { name: 'Jobnest DOCX Preview', level: 1 })).toBeVisible();
    await expect(content.locator('strong')).toHaveText('Senior software engineer');
    await expect(content.getByText('Real Word document, rendered by Mammoth.')).toBeVisible();
    await expect(content.getByRole('cell', { name: 'Playwright', exact: true })).toBeVisible();
    // Conversion should never require a third-party resource to display a DOCX.
    await expect(content.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /default-src 'none'/);
    const forbidden = await page.request.get('/api/documents/preview-html', {
      params: { path: `${randomUUID()}/library/secret.docx` },
    });
    expect(forbidden.status(), 'Reject another user’s storage path').toBe(403);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await card.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByRole('dialog', { name: label }).locator('iframe').contentFrame()
      .getByRole('heading', { name: 'Jobnest DOCX Preview' })).toBeVisible();
  } finally {
    if (documentId) {
      const deleted = await page.request.delete(`/api/documents/${documentId}`, {
        headers: { Origin: new URL(page.url()).origin },
      });
      expect(deleted.ok(), 'Remove the uploaded test document and storage object').toBe(true);
    }
  }
});
