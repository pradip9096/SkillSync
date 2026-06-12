import { Page, expect } from '@playwright/test';

export class ExpertProfilePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async selectFirstAvailableDate() {
    const dateInput = this.page.locator('input[type="date"]');
    
    // Select tomorrow's date to match the DB seed
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    await dateInput.fill(tomorrowStr);
  }

  async selectFirstTimeSlot() {
    // Click the first available time slot button (not disabled)
    const slotButton = this.page.locator('button:not([disabled])').filter({ hasText: ':' }).first();
    await slotButton.click();
  }

  async clickBookSession() {
    const bookButton = this.page.getByRole('button', { name: /secure my appointment/i });
    await bookButton.click();
  }
}
