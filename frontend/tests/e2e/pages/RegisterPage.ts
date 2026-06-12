import { Page, Locator } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly clientRoleRadio: Locator;
  readonly expertRoleRadio: Locator;
  readonly submitButton: Locator;
  readonly errorToast: Locator;

  // Expert specific fields
  readonly nameInput: Locator;
  readonly phoneInput: Locator;
  readonly categorySelect: Locator;
  readonly experienceInput: Locator;
  readonly hourlyRateInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input#email');
    this.passwordInput = page.locator('input#password');
    
    // We assume radio inputs have values "Client" and "Expert" based on standard behavior
    this.clientRoleRadio = page.locator('input[type="radio"][value="Client"]');
    this.expertRoleRadio = page.locator('input[type="radio"][value="Expert"]');
    
    this.submitButton = page.locator('button[type="submit"]');
    this.errorToast = page.locator('p:has-text("Registration Error") + p');

    this.nameInput = page.locator('input#name');
    this.phoneInput = page.locator('input#phone');
    this.categorySelect = page.locator('select#category');
    this.experienceInput = page.locator('input#experience');
    this.hourlyRateInput = page.locator('input#hourlyRate');
  }

  async navigate() {
    await this.page.goto('/register');
  }

  async registerClient(email: string, pass: string) {
    await this.page.selectOption('select#role', 'Client');
    await this.emailInput.fill(email);
    await this.passwordInput.fill(pass);
    await this.page.locator('input#confirmPassword').fill(pass);
    await this.submitButton.click();
  }
}
