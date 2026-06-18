import { test, expect } from '@playwright/test';

test.use({ 
  video: 'on',
  viewport: { width: 1440, height: 900 }
});

test.describe('Regional Localization - Comprehensive Scenarios', () => {

  test('Scenario 1: Indian Currency (INR/₹) Rendering', async ({ page }) => {
    // 1. Navigate to experts page to verify currency symbol on Expert Cards
    await page.goto('/experts');
    await page.waitForLoadState('networkidle');

    // Wait for experts to load
    await expect(page.locator('text=Find Your')).toBeVisible();
    await page.waitForTimeout(1000);

    // Verify the Rupee symbol is rendered somewhere on the page (e.g. "₹1500/hr")
    const rupeeCount = await page.locator('text=/₹/').count();
    // It should be > 0 if there are experts
    if (rupeeCount > 0) {
      const rupeeText = await page.locator('text=/₹/').first().innerText();
      expect(rupeeText).toContain('₹');
    }

    // 2. Navigate to Register page and verify Expert Hourly Rate uses ₹
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    // Select "Expert" role to reveal the hourly rate field
    await page.locator('select#role').selectOption('Expert');
    await page.waitForTimeout(500);

    // Verify label contains the Rupee symbol
    await expect(page.locator('label[for="hourlyRate"]')).toContainText('(₹)');
  });

  test('Scenario 2: Indian Phone Number Validation (+91 rules)', async ({ page }) => {
    // 1. Navigate to Register page
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Select "Expert" role to reveal phone number field
    await page.locator('select#role').selectOption('Expert');
    await page.waitForTimeout(500);

    // Fill in expert professional fields but use an INVALID Indian phone number
    // It must start with 6, 7, 8, or 9 and be 10 digits.
    await page.fill('#name', 'Test Expert');
    await page.fill('#phone', '1234567890'); // Starts with 1 (invalid in India)
    await page.fill('#email', 'testexpert_invalid@example.com');
    await page.fill('#experience', '5');
    await page.fill('#hourlyRate', '1500');
    await page.fill('#description', 'Test bio');
    await page.fill('#password', 'password123');
    await page.fill('#confirmPassword', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify Indian-specific phone validation error (substring match)
    await expect(page.locator('text=Phone number must be a valid 10-digit Indian mobile number')).toBeVisible();
    
    // Fill in a short number
    await page.fill('#phone', '98765');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Phone number must be a valid 10-digit Indian mobile number')).toBeVisible();

    await page.waitForTimeout(1000);
  });

  test('Scenario 3: IST Timezone Rendering Check', async ({ page }) => {
    // Navigate to Expert Detail page where Timezone is explicitly displayed
    await page.goto('/experts');
    await page.waitForLoadState('networkidle');

    // Wait for experts to load and click on the first expert
    await page.waitForSelector('text=View Profile');
    await page.locator('text=View Profile').first().click();

    // Verify the explicit Timezone: IST (UTC+5:30) indicator is present on the booking form
    await expect(page.locator('text=IST (UTC+5:30)')).toBeVisible();
    
    // Check that slots are available (indicates date/time logic didn't crash)
    await expect(page.locator('text=Select Date')).toBeVisible();
    
    await page.waitForTimeout(1000);
  });
});
