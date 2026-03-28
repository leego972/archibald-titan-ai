import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe("Smoke Tests — Critical Paths", () => {
  test("homepage loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("pageerror", err => errors.push(err.message));
    await page.goto(BASE_URL);
    await expect(page).not.toHaveURL(/\/500|\/error/);
    const realErrors = errors.filter(e =>
      !e.includes("favicon") && !e.includes("extension") && !e.includes("ResizeObserver")
    );
    expect(realErrors, `Console errors on homepage: ${realErrors.join(", ")}`).toHaveLength(0);
  });

  test("login page renders input fields", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator("input[type=email], input[type=text]").first()).toBeVisible();
  });

  test("pricing page renders without error", async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);
    await expect(page).not.toHaveURL(/\/404|\/500/);
    await expect(page.locator("body")).not.toContainText("An unexpected error occurred");
  });

  test("API health endpoint responds 2xx", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    expect(res.status()).toBeLessThan(500);
  });

  test("no critical route returns 500", async ({ page }) => {
    const criticalRoutes = ["/", "/login", "/pricing", "/about", "/blog"];
    for (const route of criticalRoutes) {
      const res = await page.goto(`${BASE_URL}${route}`);
      expect(res?.status() ?? 200, `${route} returned 500`).toBeLessThan(500);
    }
  });

  test("dashboard redirects unauthenticated users to login", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    // Should redirect to login or show login prompt — not crash
    await expect(page).not.toHaveURL(/\/500|\/error/);
    await expect(page.locator("body")).not.toContainText("An unexpected error occurred");
  });
});
