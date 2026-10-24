import { expect, test, type Page } from "@playwright/test";

import { gotoHydrated, USERS } from "./fixtures";

// M5 acceptance: routine → occurrence closed; diagnostic → issue → resolved; invoice
// recorded (duplicate rejected) → paid → reports; viewers read-only.

const unique = () => Date.now().toString(36);

async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

test.describe("as owner", () => {
  test.use({ storageState: USERS.owner.storage });

  test("routine, diagnostic → issue, invoice → reports", async ({ page }) => {
    const id = unique();

    // Routine due today → close it
    await gotoHydrated(page, "/routines/new");
    await page.getByLabel("Name").fill(`E2E routine ${id}`);
    await page.getByLabel("Cadence").selectOption("weekly");
    await page.getByRole("button", { name: "Create routine" }).click();
    await expect(page.getByRole("heading", { name: `E2E routine ${id}` })).toBeVisible();
    await page.goto("/routines");
    const due = page.getByRole("listitem").filter({ hasText: `E2E routine ${id}` });
    await expect(due.getByText("Today")).toBeVisible();
    await due.getByRole("button", { name: /^Done:/ }).click();
    await expectToast(page, /done/);
    await expect(page.getByRole("listitem").filter({ hasText: `E2E routine ${id}` })).toHaveCount(
      0,
    );
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: `E2E routine ${id}` })
        .getByText("100%"),
    ).toBeVisible();

    // Diagnostic → issue → resolve (resolution required)
    await gotoHydrated(page, "/diagnostics/new");
    await page.getByLabel("Client").selectOption({ label: "Contoso Example Dental" });
    await page.getByLabel("Type").fill(`E2E audit ${id}`);
    await page.getByLabel("Score (0–100, optional)").fill("150");
    await page.getByLabel("Summary").fill("Synthetic findings.");
    await page.getByRole("button", { name: "Record diagnostic" }).click();
    await expect(page.getByText("Score 0–100")).toBeVisible();
    await page.getByLabel("Score (0–100, optional)").fill("81");
    await page.getByRole("button", { name: "Record diagnostic" }).click();
    const diag = page.getByRole("listitem").filter({ hasText: `E2E audit ${id}` });
    await expect(diag).toBeVisible();
    await diag.getByRole("link", { name: "Open an issue from this" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("From diagnostic")).toHaveValue(/[0-9a-f-]{36}/);
    await page.getByLabel("Title").fill(`E2E issue ${id}`);
    await page.getByLabel("Severity").selectOption("critical");
    await page.getByRole("button", { name: "Open issue" }).click();
    await expect(page.getByRole("heading", { name: `E2E issue ${id}` })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Issue status").selectOption("resolved");
    await expect(page.getByRole("button", { name: "Update" })).toBeDisabled();
    await page.getByLabel("Resolution").fill("Synthetic fix applied.");
    await page.getByRole("button", { name: "Update" }).click();
    await expectToast(page, "Issue resolved");
    await expect(page.getByText("Resolution: Synthetic fix applied.")).toBeVisible();

    // Invoice metadata → duplicate rejected → mark paid
    const number = `E2E-${id}`;
    for (const attempt of [1, 2]) {
      await gotoHydrated(page, "/invoices/new");
      await page.getByLabel("Client").selectOption({ label: "Contoso Example Dental" });
      await page.getByLabel("Invoice number").fill(number);
      await page.getByLabel("Amount (USD)").fill("1,234.56");
      await page.getByRole("button", { name: "Record invoice" }).click();
      if (attempt === 1) {
        await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
      } else {
        await expect(
          page.getByText("That invoice number is already recorded for this system."),
        ).toBeVisible();
      }
    }
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    const row = page.getByRole("row").filter({ hasText: number });
    await expect(row.getByText("$1,234.56")).toBeVisible();
    await row.getByRole("button", { name: `Mark ${number} paid` }).click();
    await row.getByRole("button", { name: "Save" }).click();
    await expectToast(page, `${number} marked paid`);
    await expect(page.getByRole("row").filter({ hasText: number }).getByText("Paid")).toBeVisible();

    // Reports reflect it
    await page.goto("/reports");
    for (const heading of [
      "Pipeline",
      "Receivables",
      "Project health",
      "Overdue tasks",
      "Routine compliance",
      "Open issues",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(page.getByRole("row").filter({ hasText: `E2E routine ${id}` })).toBeVisible();
  });
});

test.describe("as viewer", () => {
  test.use({ storageState: USERS.viewer.storage });

  test("viewer can read operations but not change them", async ({ page }) => {
    await page.goto("/routines");
    await expect(page.getByRole("heading", { name: "Routines", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "New routine" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Done:/ })).toHaveCount(0);
    await page.goto("/invoices");
    await expect(page.getByRole("button", { name: /Mark .* paid/ })).toHaveCount(0);
    for (const path of ["/routines/new", "/invoices/new", "/issues/new", "/diagnostics/new"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });
});
