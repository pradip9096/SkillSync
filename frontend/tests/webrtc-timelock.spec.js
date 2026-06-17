import { test, expect } from '@playwright/test';

test.describe('WebRTC Time-Lock Edge Case', () => {
  test('User is blocked if trying to join > 5 mins early', async ({ page }) => {
    // 1. Intercept Auth (Bypass login screen)
    await page.route('**/api/v1/auth/me', route => {
      route.fulfill({
        status: 200,
        json: { success: true, data: { _id: 'client123', role: 'Client', name: 'Test Client' } }
      });
    });

    // 2. Intercept Booking Fetch (Simulate successful basic fetch)
    await page.route('**/api/v1/bookings/123', route => {
      route.fulfill({
        status: 200,
        json: { success: true, data: { _id: '123', client: 'client123', expert: 'expert123' } }
      });
    });

    // 3. Intercept STUN/TURN endpoint (Simulate backend Time-Lock trigger)
    await page.route('**/api/v1/bookings/123/video-token', route => {
      route.fulfill({
        status: 403,
        json: { success: false, error: 'Video room opens 5 minutes before the scheduled start time.' }
      });
    });

    // Inject mock auth token to pass ProtectedRoute logic
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock_token');
    });

    // Navigate to the video session
    await page.goto('/video-session/123');

    // Wait for the UI to display the backend's explicit lockout error
    await expect(page.locator('text=Video room opens 5 minutes before the scheduled start time.')).toBeVisible({ timeout: 5000 });
  });
});
