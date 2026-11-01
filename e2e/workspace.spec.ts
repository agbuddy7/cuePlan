import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('complete vendor, decision, timeline, persistence and undo journey', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Vendors', exact: true }).click();
  await page.getByLabel('Vendor name').fill('Community Kitchen');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('food');
  await page
    .getByRole('combobox', { name: 'Pricing basis', exact: true })
    .selectOption('per-guest');
  await page.getByLabel('Quoted amount (₹)').fill('400');
  await page.getByRole('combobox', { name: 'Tax status', exact: true }).selectOption('included');
  await page.getByLabel('Cancellation terms').fill('Refund before 14 days');
  await page.getByRole('button', { name: 'Save quote for comparison' }).click();
  await page.getByRole('button', { name: 'Accept quote', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Accepted quote', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'Decisions', exact: true }).click();
  await page.getByRole('tabpanel').getByLabel('Guests', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Preview scenario' }).click();
  await expect(page.getByRole('heading', { name: 'Before / after decision' })).toBeVisible();
  await page.getByRole('button', { name: 'Apply reviewed scenario' }).click();
  await expect(page.locator('.setup').getByLabel('Guests', { exact: true })).toHaveValue('200');
  await page.getByRole('tab', { name: 'Timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Complete task', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Completed', exact: true })).toHaveCount(1);
  await page.getByLabel('Delay days for venue').fill('40');
  await page.getByLabel('Owner for venue').fill('Asha');
  await page
    .getByLabel('Owner for venue')
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Save task' })
    .click();
  await page.reload();
  await page.getByRole('tab', { name: 'Vendors', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Community Kitchen', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accepted quote', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await page.getByRole('tab', { name: 'Timeline', exact: true }).click();
  await expect(page.getByLabel('Delay days for venue')).toHaveValue('0');
});

test('keyboard tabs, all-panel accessibility and production CSP', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("style-src 'self'");
  const budget = page.getByRole('tab', { name: 'Budget', exact: true });
  await budget.focus();
  await budget.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Vendors', exact: true })).toBeFocused();
  for (const tab of ['Budget', 'Vendors', 'Timeline', 'Decisions', 'Risks', 'Activity']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
  await page.getByRole('tab', { name: 'Budget', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('workspace.png'), fullPage: true });
});

test('export imports into a fresh workspace and malformed import is rejected', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Missing export');
  const fresh = await browser.newPage();
  await fresh.goto('/');
  await fresh.getByLabel('Import workspace').setInputFiles(path);
  await expect(fresh.getByRole('status')).toContainText('Workspace imported');
  await fresh
    .getByLabel('Import workspace')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(fresh.getByRole('status')).toContainText('Import rejected');
  await fresh.close();
});

test('AI failure leaves a functional grounded coordinator and printable summary', async ({
  page,
}) => {
  await page.route('**/api/coordinate', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask Gemini to review plan' }).click();
  await expect(page.getByText('Built-in coordinator', { exact: true })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: 'CuePlan operating summary' })).toBeVisible();
});
