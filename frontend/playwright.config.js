import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    // TASK 4.2: Inject synthetic hardware virtualization to bypass headless server constraints
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
  ],
  webServer: [
    {
      command: 'cd ../backend && node src/e2e-server.js',
      url: 'http://localhost:5005',
      reuseExistingServer: !process.env.CI,
      timeout: 15 * 1000,
      env: {
        NODE_ENV: 'test',
        PORT: '5005'
      }
    },
    {
      command: 'npm run dev -- --port 5175',
      url: 'http://localhost:5175',
      reuseExistingServer: !process.env.CI,
      timeout: 15 * 1000,
      env: {
        VITE_API_URL: 'http://localhost:5005/api/v1',
        VITE_SOCKET_URL: 'http://localhost:5005'
      }
    }
  ]
});
