import { test, expect } from '@playwright/test';

test.describe('Feature 3.5 - Chat & Notification UI', () => {
  let expertId: string;
  let clientUserId: string;
  const expertEmail = 'chat-expert@skillsync.com';
  const clientEmail = 'chat-client@skillsync.com';
  const password = 'TestPassword123!';

  test.beforeEach(async ({ request }) => {
    // Seed test data via API
    const response = await request.post('http://localhost:5000/api/test/seed-chat-e2e');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expertId = data.expertId;
    clientUserId = data.clientUserId;
  });

  test('E2E-CHAT-001: Real-time Chat Exchange', async ({ browser }) => {
    // Spin up two isolated browser contexts
    const contextA = await browser.newContext(); // Client
    const contextB = await browser.newContext(); // Expert

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // 1. Log Client in (pageA)
    await pageA.goto('http://localhost:5173/login');
    await pageA.fill('input[type="email"]', clientEmail);
    await pageA.fill('input[type="password"]', password);
    await pageA.click('button[type="submit"]');
    await expect(pageA.locator('nav').getByText('Messaging', { exact: true })).toBeVisible({ timeout: 10000 });

    // 2. Log Expert in (pageB)
    await pageB.goto('http://localhost:5173/login');
    await pageB.fill('input[type="email"]', expertEmail);
    await pageB.fill('input[type="password"]', password);
    await pageB.click('button[type="submit"]');
    await expect(pageB.locator('nav').getByText('Messaging', { exact: true })).toBeVisible({ timeout: 10000 });

    // 3. Navigate both to Messaging
    await pageA.goto('http://localhost:5173/messaging');
    await pageB.goto('http://localhost:5173/messaging');

    // 4. Select the conversation on both screens
    // Client selecting Expert
    await pageA.getByRole('button', { name: 'Chat with Chat Expert' }).click();
    
    // Expert selecting Client
    await pageB.getByRole('button', { name: 'Chat with Chat Client' }).click();

    // 5. Client sends a message
    const clientMessage = `Hello from Client at ${Date.now()}!`;
    await pageA.getByLabel('Message content').fill(clientMessage);
    await pageA.getByRole('button', { name: 'Send message' }).click();

    // 6. Assert Expert's DOM renders the message in real-time
    await expect(pageB.getByText(clientMessage).first()).toBeVisible({ timeout: 5000 });

    // 7. Expert sends a reply
    const expertMessage = `Hello from Expert at ${Date.now()}!`;
    await pageB.getByLabel('Message content').fill(expertMessage);
    await pageB.getByRole('button', { name: 'Send message' }).click();

    // 8. Assert Client's DOM renders the reply in real-time
    await expect(pageA.getByText(expertMessage).first()).toBeVisible({ timeout: 5000 });

    await contextA.close();
    await contextB.close();
  });

  test('E2E-CHAT-002: Unread Badge Counter', async ({ browser }) => {
    const contextA = await browser.newContext(); // Client
    const contextB = await browser.newContext(); // Expert

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Client login
    await pageA.goto('http://localhost:5173/login');
    await pageA.fill('input[type="email"]', clientEmail);
    await pageA.fill('input[type="password"]', password);
    await pageA.click('button[type="submit"]');
    await expect(pageA.locator('nav').getByText('Messaging', { exact: true })).toBeVisible({ timeout: 10000 });
    
    // Expert login
    await pageB.goto('http://localhost:5173/login');
    await pageB.fill('input[type="email"]', expertEmail);
    await pageB.fill('input[type="password"]', password);
    await pageB.click('button[type="submit"]');
    await expect(pageB.locator('nav').getByText('Messaging', { exact: true })).toBeVisible({ timeout: 10000 });

    // Client goes to Messaging and selects Expert
    await pageA.goto('http://localhost:5173/messaging');
    await pageA.getByRole('button', { name: 'Chat with Chat Expert' }).click();

    // Expert STAYS on Expert Dashboard (not messaging)
    
    // Client sends message
    const msg = `Hidden message ${Date.now()}`;
    await pageA.getByLabel('Message content').fill(msg);
    await pageA.getByRole('button', { name: 'Send message' }).click();

    // Assert Expert's Navbar UI renders an unread message badge (a red dot)
    // The link to messaging has a span with bg-red-500
    const messagingLink = pageB.locator('a[href="/messaging"]');
    await expect(messagingLink.locator('.bg-red-500')).toBeVisible({ timeout: 5000 });

    // Click it to go to messaging
    await messagingLink.click();
    await pageB.waitForURL('http://localhost:5173/messaging');
    
    await pageB.getByRole('button', { name: /Chat Client/ }).click();

    // Once the messages load, the unread count should be cleared.
    // The red dot should disappear.
    await expect(messagingLink.locator('.bg-red-500')).toBeHidden({ timeout: 5000 });

    await contextA.close();
    await contextB.close();
  });

  test('E2E-CHAT-003: System Notification Push', async ({ browser, request }) => {
    const contextA = await browser.newContext(); // Client
    const pageA = await contextA.newPage();

    // Client login
    await pageA.goto('http://localhost:5173/login');
    await pageA.fill('input[type="email"]', clientEmail);
    await pageA.fill('input[type="password"]', password);
    await pageA.click('button[type="submit"]');
    await expect(pageA.locator('nav').getByText('Messaging', { exact: true })).toBeVisible({ timeout: 10000 });

    // Trigger Notification via Backend test API
    const notifMsg = `Booking Confirmed ${Date.now()}!`;
    const response = await request.post('http://localhost:5000/api/test/trigger-notification', {
      data: {
        userId: clientUserId,
        type: 'SYSTEM',
        title: 'Test Notification',
        message: notifMsg
      }
    });
    expect(response.ok()).toBeTruthy();

    // The frontend should receive a Socket.io event and show an unread badge on the Notifications link
    const notifLink = pageA.locator('a[href="/notifications"]');
    await expect(notifLink.locator('.bg-red-500')).toBeVisible({ timeout: 5000 });

    // Click it to go to notifications page
    await notifLink.click();
    await pageA.waitForURL('http://localhost:5173/notifications');
    
    // The notification text should be visible on the page
    await expect(pageA.getByText(notifMsg)).toBeVisible({ timeout: 5000 });

    await contextA.close();
  });
});
