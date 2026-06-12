import { Page, Locator } from '@playwright/test';

export class ExpertDashboardPage {
  readonly page: Page;
  readonly scheduleTab: Locator;
  readonly analyticsTab: Locator;
  readonly dateInput: Locator;
  readonly successToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scheduleTab = page.locator('button:has-text("Availability Blocks")');
    this.analyticsTab = page.locator('button:has-text("Business Analytics")');
    this.dateInput = page.locator('input[type="date"]');
    this.successToast = page.locator('.bg-green-50');
  }

  async navigateToDashboard() {
    await this.page.goto('/expert-dashboard');
  }

  async navigateToScheduleTab() {
    await this.scheduleTab.click();
  }

  async navigateToAnalyticsTab() {
    await this.analyticsTab.click();
  }

  async selectDate(dateStr: string) {
    await this.dateInput.fill(dateStr);
  }

  getSlotButton(time: string): Locator {
    // E.g. time: "10:00 AM"
    return this.page.locator(`button:has-text("${time}")`);
  }

  async toggleSlot(time: string) {
    await this.getSlotButton(time).click();
  }

  async getTotalEarningsValue(): Promise<string> {
    return await this.page.locator('div:has(span:has-text("Total Earnings")) > h3').innerText();
  }

  getMonthlyRevenueTrend(): Locator {
    return this.page.locator('h3:has-text("Monthly Revenue Trend")');
  }
}
