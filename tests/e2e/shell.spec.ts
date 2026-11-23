import { expect, test } from "@playwright/test";

import { USERS } from "./fixtures";

// Minimal shell (Dashboard + Clients tabs), installable app, and security headers (A8, A9)

test.describe("as owner", () => {
  test.use({ storageState: USERS.owner.storage });

  test("sidebar has two tabs: Dashboard and Clients", async ({ page }) => {
    await page.goto("/login/dashboard");
    const nav = page.locator("[data-sidebar=content]");
    await expect(nav.getByRole("link")).toHaveCount(2);
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Clients" })).toBeVisible();
    await page.screenshot({ path: "test-results/evidence/dashboard-owner.png", fullPage: true });
  });

  test("removed pages are gone", async ({ page }) => {
    for (const path of ["/clients", "/pioneer", "/settings/workspace", "/agents/queue"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });

  test("the app can be installed (manifest and icons are public)", async ({ browser }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const manifest = await anon.request.get("/login/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    const body = (await manifest.json()) as { start_url: string; scope: string; display: string };
    expect(body.start_url).toBe("/login/dashboard");
    expect(body.scope).toBe("/login/");
    expect(body.display).toBe("standalone");
    for (const icon of ["/login/app-icon/192", "/login/app-icon/512", "/login/apple-icon"]) {
      const res = await anon.request.get(icon);
      expect(res.ok(), icon).toBe(true);
      expect(res.headers()["content-type"]).toContain("image/png");
    }
    expect((await anon.request.get("/login/app-icon/64")).status()).toBe(404);
    await anon.close();
  });

  test("security headers are present", async ({ page }) => {
    const response = await page.goto("/login/dashboard");
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toMatch(
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
    );
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");

    const robots = await page.request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /");
  });
});
