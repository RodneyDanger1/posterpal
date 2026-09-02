import { defineConfig } from "@playwright/test";

/**
 * E2E harness for PosterPal.
 *
 * Runs a SEPARATE dev server on :8081 with an in-memory PGLite (PGLITE_MEMORY=1)
 * so every run starts from a freshly-seeded practice desk and never clashes with
 * a dev server the operator has open on :8080.
 *
 * The app hydrates async (~2-4s on first load) and renders toasts in a portal,
 * so assertions rely on Playwright's auto-retrying expect(...).toBeVisible()
 * rather than a bare snapshot. `workers: 1` keeps specs serial — this is a
 * single-operator desk with shared state, and parallel mutations would flake.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8081",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "cross-env VITE_AUTH_ENABLED=false PGLITE_MEMORY=1 vite dev --host 0.0.0.0 --port 8081",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // cold Vite boot was measured at ~44s on this box
  },
});
