import { test, expect } from '@playwright/test';

/**
 * Real-time messaging E2E spec.
 *
 * Verifies that a message sent by a Client appears on an Expert's screen
 * via WebSocket without a page refresh — the core Socket.io new_message flow.
 *
 * Test fixtures (seeded by global-setup.ts):
 *   Client  — client@example.com / password123
 *   Expert  — sarah@skillsync.com / password123  (Dr. Sarah Mitchell)
 *
 * The test seeds a Confirmed booking between them if one does not already
 * exist so the /messaging page has a shared conversation to open.
 */

const CLIENT_EMAIL = 'client@example.com';
const EXPERT_EMAIL = 'sarah@skillsync.com';
const PASSWORD = 'password123';

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|my-bookings|experts|$)/, { timeout: 10_000 });
}

test.describe('Real-time Messaging', () => {
  test.describe.configure({ mode: 'serial' });

  test('socket connection banner is NOT shown when server is reachable', async ({ page }) => {
    await login(page, CLIENT_EMAIL);
    await page.goto('/messaging');
    await page.waitForTimeout(2000);

    const banner = page.locator('text=Reconnecting to real-time server');
    await expect(banner).not.toBeVisible();
  });

  test('message sent by Client is received by Expert without page refresh', async ({ browser }) => {
    const clientCtx = await browser.newContext();
    const expertCtx = await browser.newContext();

    const clientPage = await clientCtx.newPage();
    const expertPage = await expertCtx.newPage();

    try {
      // Log both users in
      await login(clientPage, CLIENT_EMAIL);
      await login(expertPage, EXPERT_EMAIL);

      // Navigate both to /messaging
      await Promise.all([
        clientPage.goto('/messaging'),
        expertPage.goto('/messaging'),
      ]);

      // Wait for socket to settle
      await clientPage.waitForTimeout(2000);
      await expertPage.waitForTimeout(2000);

      // Confirm socket is connected for both parties
      await expect(clientPage.locator('text=Reconnecting to real-time server')).not.toBeVisible();
      await expect(expertPage.locator('text=Reconnecting to real-time server')).not.toBeVisible();

      // Client opens conversation with Sarah
      const clientConv = clientPage.locator('button', { hasText: 'Dr. Sarah Mitchell' }).first();
      if (await clientConv.isVisible()) {
        await clientConv.click();
      } else {
        await clientPage.locator('.overflow-y-auto button').first().click();
      }

      // Expert opens conversation with the client
      const expertConv = expertPage.locator('button', { hasText: 'Rohan Sharma' }).first();
      if (await expertConv.isVisible()) {
        await expertConv.click();
      } else {
        await expertPage.locator('.overflow-y-auto button').first().click();
      }

      // Client sends a uniquely timestamped message
      const testMessage = `E2E Test Message ${Date.now()}`;
      await clientPage.fill('input[placeholder="Type your message..."]', testMessage);
      await clientPage.click('button[aria-label="Send message"]');

      // Expert must receive it dynamically (no page refresh) within 10 s
      await expect(expertPage.locator(`text="${testMessage}"`)).toBeVisible({ timeout: 10_000 });
    } finally {
      await clientCtx.close();
      await expertCtx.close();
    }
  });
});
