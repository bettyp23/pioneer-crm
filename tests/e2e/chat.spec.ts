import { expect, test, type Page } from "@playwright/test";

import { gotoHydrated, USERS } from "./fixtures";

// M8: one conversation with Pioneer (Claude) and Michael Scott (Grok). No worker runs in these
// tests, so sends stay queued; the test cancels them at the end so a real worker started later
// on the same database never sends them.

const unique = () => Date.now().toString(36);

async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

test.describe("as owner", () => {
  test.use({ storageState: USERS.owner.storage });

  test("write to Pioneer and Michael Scott; flagged text needs a confirmation", async ({
    page,
  }) => {
    const id = unique();
    await gotoHydrated(page, "/pioneer");
    await expect(page.getByRole("heading", { name: "Pioneer", exact: true })).toBeVisible();
    await expect(page.getByText(/the discovery follow-up email is waiting/)).toBeVisible();

    // Default recipient: Pioneer decides
    await page.getByLabel("Message").fill(`E2E question ${id}`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const first = page.getByRole("listitem").filter({ hasText: `E2E question ${id}` });
    await expect(first.getByText("Queued")).toBeVisible();
    await expect(page.getByLabel("Message")).toHaveValue("");

    // Straight to Michael Scott, with a contact detail: warned first, sent only on confirmation
    await page.getByLabel("Send to").selectOption({ label: "Michael Scott (Grok team)" });
    await page.getByLabel("Message").fill(`E2E task ${id}: email avery@northwind.example`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Check before sending")).toBeVisible();
    await expect(page.getByText(/contains: Email address/)).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: `E2E task ${id}` })).toHaveCount(0);
    await page.getByRole("button", { name: "Send anyway" }).click();
    const second = page.getByRole("listitem").filter({ hasText: `E2E task ${id}` });
    await expect(second.getByText("Sent after a warning")).toBeVisible();
    await expect(second.getByText("Queued")).toBeVisible();

    // The dashboard shows what is in progress
    await gotoHydrated(page, "/dashboard");
    await expect(page.getByRole("heading", { name: "Pioneer" })).toBeVisible();
    await expect(page.getByText(/[1-9]\d* in progress/)).toBeVisible();

    // Both sends are at-most-once jobs; cancel them so nothing is ever sent from this test
    await gotoHydrated(page, "/agents/jobs");
    for (const kind of ["claude.task", "grok.dispatch"]) {
      const rows = page
        .getByRole("row")
        .filter({ hasText: kind })
        .filter({ has: page.getByRole("button", { name: "Cancel" }) });
      while ((await rows.count()) > 0) {
        await rows.first().getByRole("button", { name: "Cancel" }).click();
        await expectToast(page, "Job cancelled");
        await page.waitForLoadState("networkidle");
      }
    }
    await gotoHydrated(page, "/pioneer");
    await expect(first.getByText("Cancelled")).toBeVisible();

    await page.goto("/settings/audit");
    await expect(page.getByRole("cell", { name: "message.sent" }).first()).toBeVisible();
  });
});

test.describe("as viewer", () => {
  test.use({ storageState: USERS.viewer.storage });

  test("viewer reads the conversation but cannot write", async ({ page }) => {
    await page.goto("/pioneer");
    await expect(page.getByText(/the discovery follow-up email is waiting/)).toBeVisible();
    await expect(page.getByText("Only owners and admins can write to Pioneer.")).toBeVisible();
    await expect(page.getByLabel("Message")).toHaveCount(0);
  });
});
