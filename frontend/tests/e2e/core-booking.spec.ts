import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ExpertDirectoryPage } from './pages/ExpertDirectoryPage';
import { ExpertProfilePage } from './pages/ExpertProfilePage';

test.describe('Feature 3.1 - The Core Booking Journey', () => {

  test.beforeAll(async ({ request }) => {
    // 1. Hit the backend test seed endpoint
    const res = await request.post('http://localhost:5000/api/test/seed-booking-e2e');
    const body = await res.text();
    expect(res.status(), `Backend seed failed: ${body}`).toBe(201);
  });

  test.beforeEach(async ({ page }) => {
    // Intercept Razorpay SDK script to inject our own mock implementation
    await page.route('https://checkout.razorpay.com/v1/checkout.js', async route => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          window.Razorpay = function(options) {
            return {
              open: function() {
                setTimeout(() => {
                  options.handler({
                    razorpay_payment_id: 'pay_test123',
                    razorpay_order_id: options.order_id || 'order_test123',
                    razorpay_signature: 'test_sig'
                  });
                }, 100);
              }
            };
          };
        `
      });
    });

    // 1. Login the user
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('client-e2e@skillsync.com', 'TestPassword123!');
  });

  test('E2E-BOOK-001: The Golden Path (Primary Critical User Journey)', async ({ page }) => {
    // Navigate to Explore Experts
    await page.goto('/experts');

    const directory = new ExpertDirectoryPage(page);
    await directory.searchForExpert('expert-e2e');
    await directory.clickExpertCard('expert-e2e');

    const profile = new ExpertProfilePage(page);
    await profile.selectFirstAvailableDate();
    await profile.selectFirstTimeSlot();
    
    // We will intercept the booking creation to simulate a successful payment locally
    // without actually loading the Razorpay iframe (which is hard to test and requires real network)
    await page.route('**/bookings', async route => {
      // NOTE: We only want to mock POST requests
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const json = {
        success: true,
        data: {
          _id: 'booking_test123',
          userName: 'client-e2e',
          userEmail: 'client-e2e@skillsync.com',
          userPhone: '+919876543210'
        },
        razorpayOrderId: 'order_test123',
        amount: 10000,
        keyId: 'rzp_test_123'
      };
      await route.fulfill({ json });
    });

    // Mock the verify payment route as well so it bypasses Razorpay
    await page.route('**/bookings/verify-payment', async route => {
      const json = {
        success: true,
        booking: {
          _id: 'booking_test123',
          status: 'Confirmed'
        }
      };
      await route.fulfill({ json });
    });

    await profile.clickBookSession();

    // Expect navigation to success page or dashboard
    // The UI currently shows a toast and might redirect to /dashboard/my-bookings
    await expect(page.getByText(/successful|confirmed/i)).toBeVisible({ timeout: 15000 });
  });

  test('E2E-BOOK-003: Race Condition UI Handling (Slot Already Booked)', async ({ page }) => {
    await page.goto('/experts');

    const directory = new ExpertDirectoryPage(page);
    await directory.searchForExpert('expert-e2e');
    await directory.clickExpertCard('expert-e2e');

    const profile = new ExpertProfilePage(page);
    await profile.selectFirstAvailableDate();
    await profile.selectFirstTimeSlot();

    // Intercept the booking API to return 409
    await page.route('**/bookings', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Slot Unavailable' })
      });
    });

    await profile.clickBookSession();

    // Assert that a toast notification with "Slot Unavailable" or similar appears
    await expect(page.getByText(/unavailable|booked|already/i)).toBeVisible();
  });
});
