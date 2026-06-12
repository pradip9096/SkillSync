import { test, expect } from '@playwright/test';
import { RegisterPage } from './pages/RegisterPage';
import { LoginPage } from './pages/LoginPage';

test.describe('Feature 3.3 - Authentication & Security Flows', () => {
  let registerPage: RegisterPage;
  let loginPage: LoginPage;
  const authEmail = 'auth-e2e@skillsync.com';
  const authPassword = 'TestPassword123!';

  test.beforeAll(async ({ request }) => {
    // Seed test data via API
    const response = await request.post('http://localhost:5000/api/test/seed-auth-e2e');
    expect(response.ok()).toBeTruthy();
  });

  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    loginPage = new LoginPage(page);
  });

  test('E2E-AUTH-001: New User Registration (Client)', async ({ page }) => {
    const dynamicEmail = `test-new-user-${Date.now()}@skillsync.com`;
    await registerPage.navigate();
    
    // Verify we are on register page
    await expect(page).toHaveURL(/.*register/);
    
    await registerPage.registerClient(dynamicEmail, authPassword);
    
    try {
      // After successful registration, frontend navigates to /experts
      await page.waitForURL('**/experts*', { timeout: 10000 });
      await expect(page).toHaveURL(/.*experts/);
    } catch (error) {
      // If it fails to navigate, maybe there's an error toast?
      const bodyText = await page.locator('body').innerText();
      console.log('Body text on failure:', bodyText);
      throw error;
    }
  });

  test('E2E-AUTH-002: Login with Valid Credentials', async ({ page }) => {
    await loginPage.navigate();
    await loginPage.login(authEmail, authPassword, true);
    
    // Verify successful redirect
    await expect(page).toHaveURL(/.*experts/);
  });

  test('E2E-AUTH-003: Login with Invalid Credentials', async ({ page }) => {
    await loginPage.navigate();
    // Use incorrect password, don't wait for navigation since it will fail
    await loginPage.login(authEmail, 'WrongPassword456!', false);
    
    // Wait for the error toast to appear
    const errorText = await loginPage.getErrorToastText();
    expect(errorText).toContain('Invalid email or password');
    
    // Ensure we are still on the login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('E2E-AUTH-004: Protected Route Access Guard', async ({ page }) => {
    // Attempt navigation to a protected route directly without being logged in
    await page.goto('/my-bookings');
    
    // The frontend should intercept and redirect to /login
    await page.waitForURL('**/login*');
    await expect(page).toHaveURL(/.*login/);
  });
});
