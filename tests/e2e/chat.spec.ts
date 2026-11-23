import { expect, test } from "@playwright/test";
import pg from "pg";

import { gotoHydrated, localDbUrl, USERS } from "./fixtures";

// The classic Michael Scott chat (worker + results sheet) at /dashboard/classic. No worker runs in
// these tests, so sends stay queued; the test cancels them at the end so a real worker started
// later on the same database never sends them.

const unique = () => Date.now().toString(36);

// The app has no jobs page any more, so the test cancels its own sends straight in the LOCAL
// database (the API keys deliberately cannot touch chat messages or jobs).
async function cancelQueuedSends(marker: string) {
  const db = new pg.Client({ connectionString: localDbUrl() });
  await db.connect();
  try {
    await db.query(
      `update public.jobs set status = 'cancelled', finished_at = now()
       where status in ('queued', 'running', 'waiting_external')
         and id in (select job_id from public.messages where body like '%' || $1 || '%')`,
      [marker],
    );
  } finally {
    await db.end();
  }
}

test.describe("as owner", () => {
  test.use({ storageState: USERS.owner.storage });

  test("message Michael from the classic chat; flagged text needs a confirmation", async ({
    page,
  }) => {
    const id = unique();
    try {
      await gotoHydrated(page, "/login/dashboard/classic");
      await expect(page.getByRole("heading", { name: "Michael Scott" })).toBeVisible();
      // Pioneer (Claude) threads are not part of this view.
      await expect(page.getByText(/the discovery follow-up email is waiting/)).toHaveCount(0);
      await expect(page.getByLabel("Send to")).toHaveCount(0);

      await page.getByLabel("Message").fill(`E2E hello ${id}`);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      const first = page.getByRole("listitem").filter({ hasText: `E2E hello ${id}` });
      await expect(first.getByText("Queued")).toBeVisible();
      await expect(page.getByLabel("Message")).toHaveValue("");

      // A contact detail: warned first, sent only on confirmation
      await page.getByLabel("Message").fill(`E2E task ${id}: email avery@northwind.example`);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByText("Check before sending")).toBeVisible();
      await expect(page.getByText(/contains: Email address/)).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: `E2E task ${id}` })).toHaveCount(0);
      await page.getByRole("button", { name: "Send anyway" }).click();
      const second = page.getByRole("listitem").filter({ hasText: `E2E task ${id}` });
      await expect(second.getByText("Sent after a warning")).toBeVisible();
      await expect(second.getByText("Queued")).toBeVisible();
      await page.screenshot({ path: "test-results/evidence/michael-chat.png", fullPage: true });
    } finally {
      await cancelQueuedSends(id);
    }
    await gotoHydrated(page, "/login/dashboard/classic");
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: `E2E hello ${id}` })
        .getByText("Cancelled"),
    ).toBeVisible();
  });
});

test.describe("as viewer", () => {
  test.use({ storageState: USERS.viewer.storage });

  test("viewer reads the conversation but cannot write", async ({ page }) => {
    await page.goto("/login/dashboard/classic");
    await expect(page.getByRole("heading", { name: "Michael Scott" })).toBeVisible();
    await expect(page.getByText("Only owners and admins can message Michael.")).toBeVisible();
    await expect(page.getByLabel("Message")).toHaveCount(0);
  });
});
