import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ExpertProfilePage } from './pages/ExpertProfilePage';

test.describe('Feature 3.4 - The Resiliency Journey (Simultaneous Bookings)', () => {
  let expertId: string;
  let targetDate: string;
  let targetTime: string;
  
  const clientAEmail = 'resiliency-client-A@skillsync.com';
  const clientBEmail = 'resiliency-client-B@skillsync.com';
  const password = 'TestPassword123!';

  test.beforeEach(async ({ request }) => {
    // Seed test data via API
    const response = await request.post('http://localhost:5000/api/test/seed-resiliency-e2e');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expertId = data.expertId;
    targetDate = data.date;
    targetTime = data.timeLabel; // The UI renders the label, not the value
  });

  test('E2E-RES-001: Simultaneous Booking Race Condition', async ({ browser }) => {
    // Spin up two completely isolated browser contexts
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const loginPageA = new LoginPage(pageA);
    const loginPageB = new LoginPage(pageB);
    
    // Log in both clients
    await loginPageA.navigate();
    await loginPageA.login(clientAEmail, password);
    
    await loginPageB.navigate();
    await loginPageB.login(clientBEmail, password);
    
    // Navigate both to the exact same expert profile
    await pageA.goto(`/expert/${expertId}`);
    await pageB.goto(`/expert/${expertId}`);
    
    const profileA = new ExpertProfilePage(pageA);
    const profileB = new ExpertProfilePage(pageB);
    
    // Both select the exact same date
    await pageA.locator('input[type="date"]').fill(targetDate);
    await pageB.locator('input[type="date"]').fill(targetDate);
    
    // Both select the exact same time slot
    await pageA.locator('button:not([disabled])').filter({ hasText: targetTime }).click();
    await pageB.locator('button:not([disabled])').filter({ hasText: targetTime }).click();
    
    // Both click the confirm button simultaneously using Promise.all
    await Promise.all([
      pageA.getByRole('button', { name: /secure my appointment/i }).click(),
      pageB.getByRole('button', { name: /secure my appointment/i }).click()
    ]);
    
    // One should succeed (open Razorpay modal) and one should fail (show error toast)
    // We wait until AT LEAST ONE of the pages displays the error toast.
    
    // The ExpertDetail page sets `bookingError` which renders as `.text-red-600` or `.bg-red-50`
    // We will poll both pages until one has the error.
    let errorFound = false;
    for (let i = 0; i < 30; i++) {
      const errorAVisible = await pageA.locator('div.bg-red-50 p').isVisible();
      const errorBVisible = await pageB.locator('div.bg-red-50 p').isVisible();
      
      if (errorAVisible) {
        const text = await pageA.locator('div.bg-red-50 p').innerText();
        expect(text.toLowerCase()).toContain('already booked');
        errorFound = true;
        break;
      }
      
      if (errorBVisible) {
        const text = await pageB.locator('div.bg-red-50 p').innerText();
        expect(text.toLowerCase()).toContain('already booked');
        errorFound = true;
        break;
      }
      
      await pageA.waitForTimeout(500);
    }
    
    expect(errorFound).toBeTruthy();
    
    await contextA.close();
    await contextB.close();
  });

  test('E2E-RES-002: Real-time Slot Disappearance', async ({ browser }) => {
    // Spin up two completely isolated browser contexts
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const loginPageA = new LoginPage(pageA);
    const loginPageB = new LoginPage(pageB);
    
    // Log in both clients
    await loginPageA.navigate();
    await loginPageA.login(clientAEmail, password);
    
    await loginPageB.navigate();
    await loginPageB.login(clientBEmail, password);
    
    // Navigate both to the exact same expert profile
    await pageA.goto(`/expert/${expertId}`);
    await pageB.goto(`/expert/${expertId}`);
    
    // Both select the exact same date
    await pageA.locator('input[type="date"]').fill(targetDate);
    await pageB.locator('input[type="date"]').fill(targetDate);
    
    // A books the slot
    await pageA.locator('button:not([disabled])').filter({ hasText: targetTime }).click();
    await pageA.getByRole('button', { name: /secure my appointment/i }).click();
    
    // We expect B's UI to dynamically update and disable the slot WITHOUT reloading
    // We wait for the slot button on pageB to become disabled.
    const slotButtonB = pageB.locator('button').filter({ hasText: targetTime });
    await expect(slotButtonB).toBeDisabled({ timeout: 10000 });
    
    await contextA.close();
    await contextB.close();
  });
});
