const { test, expect } = require('@playwright/test');

test('hero and six journey stages render', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hero')).toContainText('remembered');
  await expect(page.getByTestId('journey').locator('[data-stage]')).toHaveCount(6);
  await expect(page.getByTestId('mode-badge')).toContainText(/live|groq|demo/i);
});

test('companion falls back to demo replies without the Groq proxy', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('chat-input').fill('sharp headache and fever');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('#chat-messages')).toContainText('sharp headache and fever');
  await expect(page.getByTestId('mode-badge')).toHaveText('demo fallback');
});

test('share code and clinician brief stay in this browser', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('chat-input').fill('peanut allergy');
  await page.getByTestId('chat-send').click();
  await page.getByTestId('btn-create-share').click();
  const code = (await page.getByTestId('share-code').innerText()).trim();
  expect(code).toMatch(/^CAD-[A-Z0-9]{6}$/);
  await page.getByTestId('btn-open-brief').click();
  await expect(page.getByTestId('brief-out')).toContainText('Visit Brief');
  await expect(page.getByTestId('brief-out')).toContainText(code);
});
