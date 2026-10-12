import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.E2E_PORT || 3210);
const DATA_DIR = path.join(os.tmpdir(), `atlas-e2e-${process.pid}`);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // Tests run against the production build (`npm run build` first) to verify it.
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/info`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ATLAS_DATA_DIR: DATA_DIR },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
