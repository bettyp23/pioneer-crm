import { expect, test } from "@playwright/test";

import { gotoHydrated, USERS } from "./fixtures";

// FR-UI-1, FR-WS-3, FR-AUD-2 and security headers (A8, A9)

test.describe("as owner", () => {
  test.use({ storageState: USERS.owner.storage });

  test("shell shows every module; unbuilt modules are not links", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.locator("[data-sidebar=content]");
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
    for (const name of [
      "Clients",
      "Pipeline",
      "Blueprints",
      "Projects",
      "Invoices",
      "Work queue",
    ]) {
      await expect(nav.getByRole("button", { name })).toBeDisabled();
      await expect(nav.getByRole("link", { name })).toHaveCount(0);
    }
    await page.screenshot({ path: "test-results/evidence/dashboard-owner.png", fullPage: true });
  });

  test("owner can rename the workspace and the change is audited", async ({ page }) => {
    await gotoHydrated(page, "/settings/workspace");
    await page.getByLabel("Workspace name").fill("Demo Workspace Renamed");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Workspace settings saved")).toBeVisible();
    await page.screenshot({ path: "test-results/evidence/settings-workspace.png" });

    await page.goto("/settings/audit");
    await expect(page.getByRole("cell", { name: "workspace.updated" }).first()).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "name: Demo Workspace → Demo Workspace Renamed" }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/evidence/settings-audit.png", fullPage: true });

    // Restore for other tests / reruns.
    await gotoHydrated(page, "/settings/workspace");
    await page.getByLabel("Workspace name").fill("Demo Workspace");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Workspace settings saved")).toBeVisible();
  });

  test("members and security pages render", async ({ page }) => {
    await page.goto("/settings/members");
    await expect(page.getByRole("cell", { name: `${USERS.owner.name} (you)` })).toBeVisible();
    await expect(page.getByRole("cell", { name: USERS.viewer.name })).toBeVisible();
    await page.screenshot({ path: "test-results/evidence/settings-members.png" });

    await page.goto("/settings/security");
    await expect(page.getByText("Two-step verification", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/evidence/settings-security.png" });
  });

  test("security headers are present", async ({ page }) => {
    const response = await page.goto("/dashboard");
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

test.describe("as viewer", () => {
  test.use({ storageState: USERS.viewer.storage });

  test("viewer cannot see the audit log", async ({ page }) => {
    await page.goto("/settings/workspace");
    await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
    // Read-only settings: no form.
    await expect(page.getByLabel("Workspace name")).toHaveCount(0);

    const response = await page.goto("/settings/audit");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
