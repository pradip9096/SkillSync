import { test, expect } from '@playwright/test';

test.describe('Feature 3.6 - Admin Dashboard Journey', () => {
  let adminId: string;
  let suspendedClientId: string;
  let targetBookingId: string;

  test.beforeEach(async ({ request }) => {
    // 1. Seed the database with Admin, Suspended Client, and Target Booking
    const seedResponse = await request.post('http://localhost:5000/api/test/seed-admin-e2e');
    expect(seedResponse.ok()).toBeTruthy();
    
    const data = await seedResponse.json();
    adminId = data.adminId;
    suspendedClientId = data.suspendedClientId;
    targetBookingId = data.bookingId;
  });

  test('E2E-ADMIN-001: Admin Table Search and Filtering', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'admin-e2e@skillsync.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // 2. Navigate to Admin Dashboard (Users Tab is default)
    await page.waitForURL('http://localhost:5173/experts');
    await page.goto('http://localhost:5173/admin');
    await expect(page.getByRole('heading', { name: 'Console Dashboard' })).toBeVisible();
    
    // Ensure Users table is loaded
    await expect(page.getByRole('cell', { name: 'target-expert@skillsync.com' })).toBeVisible();

    // 3. Search for the suspended client
    const searchInput = page.getByPlaceholder('Search users by name, email, role, or phone...');
    await searchInput.fill('suspended-client@skillsync.com');

    // 4. Verify table filters down (Other rows should disappear)
    await expect(page.getByRole('cell', { name: 'target-expert@skillsync.com' })).toBeHidden();
    await expect(page.getByRole('cell', { name: 'suspended-client@skillsync.com' })).toBeVisible();

    // 5. Switch to Bookings Tab
    await page.getByRole('button', { name: 'Bookings Manager', exact: true }).click();
    
    // Wait for the bookings table to render
    await expect(page.getByRole('cell', { name: 'Target Expert' })).toBeVisible();

    // 6. Verify booking search is empty and tab switching cleared states
    const bookingSearch = page.getByPlaceholder('Search by client/expert name or email...');
    await expect(bookingSearch).toHaveValue('');

    // 7. Search for booking by client email
    await bookingSearch.fill('suspended-client@skillsync.com');
    await expect(page.getByRole('cell', { name: 'Target Expert' })).toBeVisible();

    // Fill something that doesn't match
    await bookingSearch.fill('no-match-12345@skillsync.com');
    await expect(page.getByRole('cell', { name: 'Target Expert' })).toBeHidden();
  });

  test('E2E-ADMIN-002: Admin Booking Cancellation Bypass', async ({ page, request }) => {
    // 1. Login as Admin
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'admin-e2e@skillsync.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/experts');
    await page.goto('http://localhost:5173/admin');

    // 2. Switch to Bookings Tab
    await page.getByRole('button', { name: 'Bookings Manager', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Target Expert' })).toBeVisible();

    // 3. Target the booking row and click delete/cancel
    // Setup dialog auto-accept
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    
    const bookingRow = page.locator('tr').filter({ hasText: 'Target Expert' });
    await bookingRow.locator('button[title="Force Delete & Release"]').click();

    // 4. Verify booking was removed from the list or its status changed
    await expect(page.getByText('Booking deleted and slot released successfully.')).toBeVisible();
    await expect(bookingRow).toBeHidden();
  });

  test('E2E-ADMIN-003: Penalty Reset and Cooldown Lift', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'admin-e2e@skillsync.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/experts');
    await page.goto('http://localhost:5173/admin');

    // 2. Users Tab is default. Locate the suspended client
    const userRow = page.locator('tr').filter({ hasText: 'suspended-client@skillsync.com' });
    
    // Verify the suspension indicator is present (AlertCircle icon)
    await expect(userRow.locator('.text-red-600')).toBeVisible();

    // Setup dialog listener for the "Are you sure you want to reset penalties?" confirm
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    
    await userRow.getByRole('button', { name: 'Reset Penalties' }).click();

    // 4. Verify success toast and UI update
    await expect(page.getByText('Strikes reset and booking suspension lifted successfully.')).toBeVisible();
    
    // The red suspension indicator should be gone
    await expect(userRow.locator('.text-red-600')).toBeHidden();
  });
});
