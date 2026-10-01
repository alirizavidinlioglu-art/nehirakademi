import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "npm run build && LOCAL_DATABASE_PATH=.local/e2e-database npx tsx scripts/e2e-setup.ts && LOCAL_DATABASE_PATH=.local/e2e-database APP_URL=http://localhost:3001 DEV_MAIL_OUTBOX=true DEV_MAIL_OUTBOX_PATH=.local/e2e-mail-outbox npm start -- --port 3001",
    url: "http://localhost:3001/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
