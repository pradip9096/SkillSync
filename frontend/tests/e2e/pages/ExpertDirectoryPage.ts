import { Page, expect } from '@playwright/test';

export class ExpertDirectoryPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async searchForExpert(query: string) {
    await this.page.fill('input[placeholder*="Search"]', query);
    // Optional: wait for debounce or network request
    await this.page.waitForTimeout(500); 
  }

  async clickExpertCard(expertName: string) {
    const card = this.page.locator('.group').filter({ hasText: expertName });
    await card.getByRole('link', { name: /View Profile/i }).click();
    await this.page.waitForURL('**/expert/**');
  }
}
