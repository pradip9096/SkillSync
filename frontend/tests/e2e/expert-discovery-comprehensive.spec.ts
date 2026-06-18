import { test, expect } from '@playwright/test';

// Grouping scenarios for Expert Discovery
test.use({ 
  video: 'on',
  viewport: { width: 1440, height: 900 }
});

test.describe('Expert Discovery Interface - Comprehensive Scenarios', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the expert listing page directly or via landing page
    await page.goto('/experts');
    await page.waitForLoadState('networkidle');
  });

  test('Scenario 1: Full Positive Workflow (Search, Filter, View)', async ({ page }) => {
    // Wait for experts to load
    await expect(page.locator('text=Find Your')).toBeVisible();
    await page.waitForTimeout(1000);

    // 1. Search for a generic term that should match some seed data (e.g., "John" or "Technology")
    const searchInput = page.locator('input[placeholder="Search experts by name..."]');
    await searchInput.fill('e'); // Generic letter to trigger some results
    await page.waitForTimeout(1500); // Wait for debounce and query

    // 2. Filter by Category
    const categorySelect = page.locator('select');
    await categorySelect.selectOption({ label: 'Technology' });
    await page.waitForTimeout(1500); // Wait for query

    // 3. Clear filters to show all
    await searchInput.fill('');
    await categorySelect.selectOption({ label: 'All Categories' });
    await page.waitForTimeout(1500);

    // 4. Click first expert profile
    const viewProfileButtons = page.locator('text="View Profile"');
    if (await viewProfileButtons.count() > 0) {
      await viewProfileButtons.first().click();
      await page.waitForTimeout(2000);
      
      // Verify we navigated to an expert profile
      await expect(page).toHaveURL(/\/experts\/[a-zA-Z0-9_-]+/);
      await page.goBack();
      await page.waitForTimeout(1000);
    }
  });

  test('Scenario 2: Negative/Boundary Workflow (No Results Found)', async ({ page }) => {
    // 1. Search for a gibberish name that definitely does not exist
    const searchInput = page.locator('input[placeholder="Search experts by name..."]');
    await searchInput.fill('XZY123987GibberishName');
    
    // 2. Wait for the debounce and API response
    await page.waitForTimeout(1500);

    // 3. Verify the Empty State UI
    await expect(page.locator('text="No matches found."')).toBeVisible();
    await expect(page.locator('text="Try adjusting your filters or search terms."')).toBeVisible();
    await page.waitForTimeout(2000); // Leave it on screen for the recording
  });

  test('Scenario 3: Exception/Error Handling (API Failure Simulation)', async ({ page }) => {
    // 1. Mock the API to return a 500 Internal Server Error
    await page.route('**/api/v1/experts*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' })
      });
    });

    // 2. Trigger a refetch by reloading the page
    await page.reload();

    // 3. Verify the Error State UI
    await expect(page.locator('text="Failed to fetch experts. Please try again later."')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000); // Leave it on screen for the recording
  });

  test('Scenario 4: Responsiveness & Layout Verification (Mobile View)', async ({ page }) => {
    // Change viewport to mobile size
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await page.waitForTimeout(1500);

    // Verify search input and select are still visible and usable on mobile
    const searchInput = page.locator('input[placeholder="Search experts by name..."]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Tech');
    await page.waitForTimeout(1000);

    // Scroll to see the stacked layout
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);
  });
});
