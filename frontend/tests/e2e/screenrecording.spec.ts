import { test, expect } from '@playwright/test';

test.use({ 
  video: 'on',
  viewport: { width: 1280, height: 720 }
});

test('Screen recording: Landing Page & Expert Discovery', async ({ page }) => {
  // 1. Go to Landing Page
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000); // Wait for visuals
  
  // Scroll down to see features
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollBy(0, -400));
  await page.waitForTimeout(1000);

  // 2. Click Browse Experts
  await page.click('text="Browse Experts"');
  await page.waitForTimeout(3000);

  // 3. Search for an expert
  await page.fill('input[placeholder*="Search"]', 'Technology');
  await page.waitForTimeout(2000);
  
  // Clear search
  await page.fill('input[placeholder*="Search"]', '');
  await page.waitForTimeout(1000);

  // 4. Filter by Category
  const categorySelect = page.locator('select');
  if (await categorySelect.count() > 0) {
    await categorySelect.selectOption({ label: 'Technology' });
    await page.waitForTimeout(2000);
  }

  // 5. Click on an Expert to View Details
  const viewProfileButtons = page.locator('text="View Profile"');
  if (await viewProfileButtons.count() > 0) {
    await viewProfileButtons.first().click();
    await page.waitForTimeout(3000);
    
    // Scroll profile
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);
  }
});
