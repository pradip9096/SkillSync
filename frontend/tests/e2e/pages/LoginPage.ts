import { Page, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string = 'TestPassword123!', waitForNav: boolean = true) {
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    
    if (waitForNav) {
      // Wait for the login to complete and navigate
      await this.page.waitForURL('**/experts*');
    }
  }

  async getErrorToastText() {
    // According to Login.jsx, the error message text is inside a <p> after "Authentication Error"
    return await this.page.locator('p:has-text("Authentication Error") + p').innerText();
  }
}
