// Tests de bout en bout : le VRAI front (build de production) piloté dans
// Chromium, contre une base Supabase LOCALE et jetable (CI : `supabase start`
// + migrations + Edge Functions). Jamais contre la production.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.js",
  // Une seule école partagée : les scénarios s'enchaînent, sans parallélisme.
  workers: 1,
  fullyParallel: false,
  // Pas de nouvel essai automatique : un encaissement rejoué fausserait la
  // base, et un test instable doit se voir.
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: "resultats",
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "rapport" }]]
    : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Africa/Conakry",
    // Le service worker met l'app en cache : on veut le build fraîchement servi.
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: "..",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
