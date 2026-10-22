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
    await page.getByRole("link", { name: "Marketing & SEO Agent" }).click();
    await page.waitForLoadState("networkidle");
    await page
      .getByLabel("Saved instructions")
      .fill(`You are the marketing agent ${id}. Cite sources.`);
    await page.getByRole("button", { name: "Save agent" }).click();
    await expect(page.getByRole("link", { name: "Marketing & SEO Agent" })).toBeVisible();

    // Work item with business context + opt-in contacts (flagged)
    await gotoHydrated(page, "/agents/queue/new");
    await page
      .getByLabel("Agent", { exact: true })
      .selectOption({ label: "Marketing & SEO Agent" });
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
    await expect(prompt).toContainText(`You are the marketing agent ${id}`);
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
    await page
      .getByLabel("Agent", { exact: true })
      .selectOption({ label: "Marketing & SEO Agent" });
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
    await expect(page.getByRole("cell", { name: "OpenRouter" })).toBeVisible();
    await expect(page.getByLabel("Monthly cap for OpenRouter")).toHaveValue("50");
    await expect(page.getByRole("cell", { name: /Grok/ })).toHaveCount(0);
    await page.getByLabel("Cost in dollars").fill("0.42");
    await page.getByLabel("Cost note").fill(`E2E ${id}`);
    await page.getByRole("button", { name: "Record cost" }).click();
    await expectToast(page, "Cost recorded");
    await expect(page.getByText(`OpenRouter · E2E ${id}`)).toBeVisible();
  });

  test("Pioneer OS 3.0 roster replaces the Grok bots", async ({ page }) => {
    await page.goto("/agents/roster");
    for (const name of [
      "Operations Agent",
      "Sales Agent",
      "Client Onboarding Agent",
      "Development Agent",
      "QA & Security Agent",
      "Marketing & SEO Agent",
      "Client Success & Maintenance Agent",
      "Finance & Admin Agent",
    ]) {
      await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText(/Grok/)).toHaveCount(0);
  });

  test("jobs: a job that gave up can be retried", async ({ page }) => {
    await gotoHydrated(page, "/agents/jobs");
    const row = page.getByRole("row").filter({ hasText: "provider returned 503 three times" });
    // "Gave up" on a fresh seed; "Cancelled" when the suite is re-run against the same database.
    await expect(row.getByText(/^(Gave up|Cancelled)$/)).toBeVisible();
    await expect(row.getByText("Operations Agent")).toBeVisible();
    await row.getByRole("button", { name: "Retry" }).click();
    await expectToast(page, "Job queued again");
    await expect(row.getByText("Queued")).toBeVisible();
    await row.getByRole("button", { name: "Cancel" }).click();
    await expectToast(page, "Job cancelled");
    await expect(row.getByText("Cancelled")).toBeVisible();
  });

  test("kill switch pauses every agent until resumed", async ({ page }) => {
    const id = unique();
    // A ready work item to try sending
    await gotoHydrated(page, "/agents/queue/new");
    await page.getByLabel("Agent", { exact: true }).selectOption({ label: "Operations Agent" });
    await page.getByLabel("Kind of work").selectOption({ label: "Plan" });
    await page.getByLabel("Title", { exact: true }).fill(`E2E pause ${id}`);
    await page.getByLabel("What should the agent do?").fill("Plan the week.");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("heading", { name: `E2E pause ${id}` })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Mark ready" }).click();
    await expectToast(page, "Ready to send");
    const itemUrl = page.url();

    await gotoHydrated(page, "/agents/roster");
    await page.getByRole("button", { name: "Pause all agents" }).click();
    await page.getByLabel("Why are you pausing the agents?").fill(`E2E ${id}`);
    await page.getByRole("button", { name: "Pause now" }).click();
    await expectToast(page, "All agents paused");
    await expect(page.getByText("All agents are paused")).toBeVisible();

    await gotoHydrated(page, itemUrl);
    await page.getByRole("button", { name: "Mark as sent" }).click();
    await expectToast(page, "Agents are paused. Resume them in the AI Command Center first.");

    await gotoHydrated(page, "/agents/queue");
    await page.getByRole("button", { name: "Resume agents" }).click();
    await expectToast(page, "Agents resumed");
    await expect(page.getByText("All agents are paused")).toHaveCount(0);
    await gotoHydrated(page, itemUrl);
    await page.getByRole("button", { name: "Mark as sent" }).click();
    await expectToast(page, "Marked as sent");

    await page.goto("/settings/audit");
    await expect(page.getByRole("cell", { name: "ai.paused" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "ai.resumed" }).first()).toBeVisible();
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
    await page.goto("/agents/jobs");
    await expect(page.getByText("Gave up").or(page.getByText("Cancelled")).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pause all agents" })).toHaveCount(0);
    const response = await page.goto("/agents/queue/new");
    expect(response?.status()).toBe(404);
  });
});
