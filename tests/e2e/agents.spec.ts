import { expect, test, type Page } from "@playwright/test";

import { gotoHydrated, USERS } from "./fixtures";

// M6 acceptance: agent instructions → work item with curated context → sensitive content
// flagged and overridden with a reason → hand-off → output → review → proposed action →
// approval → done; budgets; viewers read-only.

const unique = () => Date.now().toString(36);

async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

test.describe("as owner", () => {
  test.use({ storageState: USERS.owner.storage });

  test("agent hand-off with flagged context, review and approval", async ({ page }) => {
    const id = unique();

    // Paste the bot's saved instructions into its agent record
    await page.goto("/agents/roster");
    await page.getByRole("link", { name: "Research Agent" }).click();
    await page.waitForLoadState("networkidle");
    await page
      .getByLabel("Saved instructions")
      .fill(`You are the research agent ${id}. Cite sources.`);
    await page.getByRole("button", { name: "Save agent" }).click();
    await expect(page.getByRole("link", { name: "Research Agent" })).toBeVisible();

    // Work item with business context + opt-in contacts (flagged)
    await gotoHydrated(page, "/agents/queue/new");
    await page.getByLabel("Agent", { exact: true }).selectOption({ label: "Research Agent" });
    await page
      .getByLabel("Client", { exact: true })
      .selectOption({ label: "Northwind Example Bakery" });
    await page.getByLabel("Title", { exact: true }).fill(`E2E research ${id}`);
    await page.getByLabel("What should the agent do?").fill("List three local competitors.");
    await page.getByLabel(/Contacts with emails and phones/).check();
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("heading", { name: `E2E research ${id}` })).toBeVisible();

    // The prompt carries the instructions and business context; contact email is flagged
    const prompt = page.locator("pre").first();
    await expect(prompt).toContainText(`You are the research agent ${id}`);
    await expect(prompt).toContainText("Northwind Example Bakery");
    await expect(page.getByText(/Sensitive content flagged/)).toBeVisible();
    await expect(page.getByText(/Email address: aver…/)).toBeVisible();

    // Ready needs a reason because of the flags
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Mark ready" })).toBeDisabled();
    await page
      .getByLabel("Reason to send flagged content")
      .fill("Synthetic: agent needs the owner's name");
    await page.getByRole("button", { name: "Mark ready" }).click();
    await expectToast(page, "Ready to send");

    // Hand-off, output, review
    await page.getByRole("button", { name: "Mark as sent" }).click();
    await expectToast(page, "Marked as sent");
    await page.getByLabel("Agent output").fill(`Synthetic output ${id}: three competitors.`);
    await page.getByRole("button", { name: "Save output" }).click();
    await expectToast(page, "Output saved");
    await page.getByRole("button", { name: "Accept output" }).click();
    await expectToast(page, "Output accepted");

    // Propose an email → Approvals page → approve → mark done
    await page.getByRole("button", { name: "Propose an action" }).click();
    await page.getByLabel("To / where").fill("avery@northwind.example");
    await page.getByLabel("Title", { exact: true }).fill(`E2E email ${id}`);
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expectToast(page, "Sent to the Approval Center");

    await gotoHydrated(page, "/approvals");
    const card = page.getByRole("listitem").filter({ hasText: `E2E email ${id}` });
    await expect(card.getByText("Waiting for approval")).toBeVisible();
    await card.getByRole("button", { name: "Approve" }).click();
    await expectToast(page, /approved/);

    await gotoHydrated(page, "/agents/actions");
    const approved = page.getByRole("listitem").filter({ hasText: `E2E email ${id}` });
    await approved.getByLabel(/What was done for/).fill("Sent from Gmail");
    await approved.getByRole("button", { name: "Mark done" }).click();
    await expectToast(page, "Marked as done");
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: `E2E email ${id}` })
        .getByText("Done", { exact: true }),
    ).toBeVisible();

    // Audit shows the trail
    await page.goto("/settings/audit");
    await expect(page.getByRole("cell", { name: "work_item.updated" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "action.updated" }).first()).toBeVisible();
  });

  test("business-only context is not flagged; usage tracks the budget", async ({ page }) => {
    const id = unique();
    await gotoHydrated(page, "/agents/queue/new");
    await page.getByLabel("Agent", { exact: true }).selectOption({ label: "Research Agent" });
    await page
      .getByLabel("Client", { exact: true })
      .selectOption({ label: "Sam Example Consulting" });
    await page.getByLabel("Title", { exact: true }).fill(`E2E clean ${id}`);
    await page.getByLabel("What should the agent do?").fill("Summarise the market.");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("heading", { name: `E2E clean ${id}` })).toBeVisible();
    await expect(page.getByText(/Sensitive content flagged/)).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Mark ready" })).toBeEnabled();

    await gotoHydrated(page, "/agents/usage");
    await expect(page.getByRole("cell", { name: "xAI (Grok)" })).toBeVisible();
    await expect(page.getByLabel("Monthly cap for xAI (Grok)")).toHaveValue("50");
    await page.getByLabel("Cost in dollars").fill("0.42");
    await page.getByLabel("Cost note").fill(`E2E ${id}`);
    await page.getByRole("button", { name: "Record cost" }).click();
    await expectToast(page, "Cost recorded");
    await expect(page.getByText(`xAI (Grok) · E2E ${id}`)).toBeVisible();
  });
});

test.describe("as viewer", () => {
  test.use({ storageState: USERS.viewer.storage });

  test("viewer can see the AI Command Center but not act", async ({ page }) => {
    await page.goto("/agents/queue");
    await expect(page.getByRole("heading", { name: "AI Command Center" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New work item" })).toHaveCount(0);
    await page.goto("/agents/actions");
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    const response = await page.goto("/agents/queue/new");
    expect(response?.status()).toBe(404);
  });
});
