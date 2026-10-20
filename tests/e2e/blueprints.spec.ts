import { expect, test, type Page } from "@playwright/test";

import { gotoHydrated, USERS } from "./fixtures";

// M3 acceptance: catalog + blueprint lifecycle; published versions are frozen;
// cycles block publishing; viewers are read-only.

const unique = () => Date.now().toString(36);

async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

test.describe("as owner", () => {
  test.use({ storageState: USERS.owner.storage });

  test("service → package → blueprint draft → publish → new draft → retire", async ({ page }) => {
    const id = unique();
    page.on("dialog", (d) => void d.accept());

    // Service
    await gotoHydrated(page, "/catalog/services/new");
    await page.getByLabel("Name", { exact: true }).fill(`E2E Service ${id}`);
    await page.getByLabel("Code").fill(`e2e-${id}`);
    await page.getByLabel("List price (USD, optional)").fill("2,500");
    await page.getByRole("button", { name: "Create service" }).click();
    await expect(page.getByRole("cell", { name: `E2E Service ${id}`, exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "$2,500" }).first()).toBeVisible();

    // Package with that service
    await gotoHydrated(page, "/catalog/packages/new");
    await page.getByLabel("Name", { exact: true }).fill(`E2E Package ${id}`);
    await page.getByRole("button", { name: "Create package" }).click();
    await expect(page.getByRole("heading", { name: `E2E Package ${id}` })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Service to add").selectOption({ label: `E2E Service ${id}` });
    await page.getByRole("button", { name: "Add service" }).click();
    await expectToast(page, "Service added");
    await expect(page.getByText(`e2e-${id}`)).toBeVisible();

    // Blueprint + draft v1
    await gotoHydrated(page, "/blueprints/new");
    await page.getByLabel("Name").fill(`E2E Blueprint ${id}`);
    await page.getByLabel("Delivers service").selectOption({ label: `E2E Service ${id}` });
    await page.getByRole("button", { name: "Create blueprint and draft" }).click();
    await expect(page.getByRole("heading", { name: /Version 1/ })).toBeVisible();
    await expect(page.getByText("Add at least one task.")).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Tasks: Discovery, then Build after Discovery
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByLabel("Task title").fill("Discovery workshop");
    await expect(page.getByLabel("Key")).toHaveValue("discovery_workshop");
    await page.getByRole("button", { name: "Add task" }).click();
    await expectToast(page, "Task added");

    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByLabel("Task title").fill("Build");
    await page.getByLabel("Approval").selectOption("client");
    await page.getByRole("checkbox", { name: /Discovery workshop/ }).check();
    await page.getByRole("button", { name: "Add task" }).click();
    await expectToast(page, "Task added");
    await expect(page.getByText("after Discovery workshop")).toBeVisible();

    // Client input that blocks Build
    await page.getByRole("button", { name: "Add client input" }).click();
    await page.getByLabel("What the client provides").fill("Brand files");
    await page.getByLabel("Blocks task").selectOption({ label: "Build" });
    await page.getByRole("button", { name: "Add input" }).click();
    await expectToast(page, "Input added");

    // Publish v1
    await page.getByLabel("What changed?").fill("First version");
    await page.getByRole("button", { name: "Publish version" }).click();
    await expectToast(page, "Version published");
    await expect(page.getByText(/Content hash [0-9a-f]{64}/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add task" })).toHaveCount(0);
    const v1Url = page.url();

    // New draft from v1 copies the content; a cycle blocks publishing.
    await page.getByRole("link", { name: `E2E Blueprint ${id}` }).click();
    await page.getByRole("button", { name: "New draft from v1" }).click();
    await expect(page.getByRole("heading", { name: /Version 2/ })).toBeVisible();
    await expect(page.getByText("after Discovery workshop")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("listitem")
      .filter({ hasText: "discovery_workshop" })
      .getByRole("button", { name: "Edit" })
      .click();
    await page.getByRole("checkbox", { name: /Build/ }).check();
    await page.getByRole("button", { name: "Save task" }).click();
    await expectToast(page, "Task saved");
    await expect(page.getByText(/Dependencies form a cycle/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish version" })).toBeDisabled();
    await page.getByRole("button", { name: "Delete draft" }).click();
    await expect(page.getByRole("heading", { name: `E2E Blueprint ${id}` })).toBeVisible();

    // v1 is still intact and read-only; retire it.
    await page.goto(v1Url);
    await expect(page.getByText("Discovery workshop", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: `E2E Blueprint ${id}` }).click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Retire" }).click();
    await expectToast(page, "v1 retired");
    await expect(page.getByText("retired", { exact: true })).toBeVisible();
  });
});

test.describe("as viewer", () => {
  test.use({ storageState: USERS.viewer.storage });

  test("viewer can read the catalog and blueprints but not change them", async ({ page }) => {
    await page.goto("/catalog/services");
    await expect(page.getByRole("cell", { name: /Website build/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "New service" })).toHaveCount(0);

    await page.goto("/blueprints");
    await page.getByRole("link", { name: "Website delivery" }).click();
    await page.getByRole("link", { name: "v1" }).click();
    await expect(page.getByText("Sitemap and wireframes", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add task" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retire" })).toHaveCount(0);

    for (const path of ["/catalog/services/new", "/catalog/packages/new", "/blueprints/new"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });
});
