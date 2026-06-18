import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Running sequentially to avoid db collisions
  reporter: 'html',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // PCI DSS Req 3.3.1: video artifacts may contain Razorpay iframe card frames.
    // CI pipelines MUST NOT upload these to external storage (S3, GitHub Actions artifacts).
    // Recordings must remain ephemeral and be discarded at workflow end.
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    {
      name: 'payments',
      // Scoped exclusively to the payment E2E suite (IP-PAY-E2E-001 §DL-02 CI isolation).
      // Run via: npm run test:e2e:payments | npm run test:e2e:payments:smoke
      testMatch: '**/payment-gateway-live.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Disable Chromium's popup blocker so Razorpay checkout is not silently suppressed
        // in headless CI environments (Chromium blocks window.open() by default).
        // Supersedes the temporary test.use() workaround that was in the spec file (DIV-P2-04).
        launchOptions: { args: ['--disable-popup-blocking'] },
        // Explicit action timeout accommodates Razorpay iframe initialization latency (2–5 s).
        // The global actionTimeout: 0 (unlimited) remains in effect for the chromium project.
        actionTimeout: 30_000,
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'cd ../backend && NODE_ENV=development npm run dev',
      url: 'http://localhost:5001',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    }
  ],
});
