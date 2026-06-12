import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ExpertDashboardPage } from './pages/ExpertDashboardPage';

test.describe('Feature 3.2 - Expert Schedule Management', () => {
  let loginPage: LoginPage;
  let expertDashboard: ExpertDashboardPage;

  test.beforeAll(async ({ request }) => {
    // Seed the database
    const response = await request.post('http://localhost:5000/api/test/seed-schedule-e2e');
    expect(response.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    // Teardown test data
    await request.delete('http://localhost:5000/api/test/teardown');
  });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    expertDashboard = new ExpertDashboardPage(page);

    // Login as the expert seeded for this test
    await loginPage.navigate();
    await loginPage.login('expert-schedule-e2e@skillsync.com', 'TestPassword123!');
    
    // Default redirect is /experts
    await page.waitForURL('**/experts');
    
    // Navigate to dashboard
    await expertDashboard.navigateToDashboard();
    await page.waitForURL('**/expert-dashboard');
  });

  test('E2E-SCHED-001: Toggle Slot Availability', async ({ page }) => {
    // Intercept the block/unblock API calls to avoid flakiness
    await page.route('**/expert-dashboard/block-slot', async route => {
      await route.continue();
    });
    await page.route('**/expert-dashboard/unblock-slot', async route => {
      await route.continue();
    });

    await expertDashboard.navigateToScheduleTab();

    // Since we seeded it for tomorrow, we need to ensure the calendar is on tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0];
    await expertDashboard.selectDate(tomorrowDateStr);

    // Wait a moment for slots to load
    await page.waitForTimeout(500); // Or better wait for an API response, but keeping it simple as we wait for DOM

    // Action 1: Toggle the 09:00 AM slot to block it
    // Note: The seeded slot is NOT created (so it's inactive by default, but wait, the logic for ExpertDashboard might show all timeslots)
    // Actually, in the ExpertDashboard.jsx, available slots are shown in green, blocked/inactive are gray.
    // If we click it, it makes an API call.
    
    const responseBlock = page.waitForResponse(response => response.url().includes('/expert-dashboard/block-slot') || response.url().includes('/expert-dashboard/unblock-slot'));
    await expertDashboard.toggleSlot('09:00 AM');
    await responseBlock;

    await expect(expertDashboard.successToast).toBeVisible();
    await expect(expertDashboard.successToast).toContainText(/blocked|open/i);

    // Action 2: Toggle it back
    const responseUnblock = page.waitForResponse(response => response.url().includes('/expert-dashboard/block-slot') || response.url().includes('/expert-dashboard/unblock-slot'));
    await expertDashboard.toggleSlot('09:00 AM');
    await responseUnblock;

    await expect(expertDashboard.successToast.last()).toBeVisible();
  });

  test('E2E-SCHED-002: View Earnings Dashboard', async ({ page }) => {
    // Wait for the analytics API response
    const analyticsResponsePromise = page.waitForResponse(response => response.url().includes('/analytics'));
    
    await expertDashboard.navigateToAnalyticsTab();
    
    // Wait for the response so data is hydrated
    await analyticsResponsePromise;

    // Check earnings
    const totalEarnings = await expertDashboard.getTotalEarningsValue();
    expect(totalEarnings).not.toBe('₹0');
    expect(totalEarnings).toContain('1,500'); // Based on our seeded past booking of amount 1500

    // Verify monthly revenue trend section is visible
    await expect(expertDashboard.getMonthlyRevenueTrend()).toBeVisible();
  });
});
