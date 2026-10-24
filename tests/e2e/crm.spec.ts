import { expect, test, type Page } from "@playwright/test";

import { gotoHydrated, USERS } from "./fixtures";

// M2 acceptance (requirements §4): create client → contact → lead → move stage →
// log activity → complete follow-up; viewers are read-only.

const unique = () => Date.now().toString(36);

async function expectToast(page: Page, text: string) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

test.describe("as owner", () => {
  test.use({ storageState: USERS.owner.storage });

  test("client → contact → lead → stage → activity → follow-up", async ({ page }) => {
    const clientName = `E2E Client ${unique()}`;

    // Client (with validation of the Drive link)
    await gotoHydrated(page, "/clients/new");
    await page.getByLabel("Name", { exact: true }).fill(clientName);
    await page.getByLabel("Google Drive folder").fill("https://example.com/not-drive");
    await page.getByRole("button", { name: "Create client" }).click();
    await expect(page.getByText("Use a Google Drive link")).toBeVisible();
    await page
      .getByLabel("Google Drive folder")
      .fill("https://drive.google.com/drive/folders/e2e-synthetic");
    await page.getByRole("button", { name: "Create client" }).click();
    await expect(page.getByRole("heading", { name: clientName })).toBeVisible();
    const clientUrl = page.url();

    // Contact
    await page
      .getByRole("navigation", { name: "Client sections" })
      .getByRole("link", { name: /Contacts/ })
      .click();
    await page.getByRole("link", { name: "Add contact" }).click();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("First name").fill("Riley");
    await page.getByLabel("Last name").fill("Synthetic");
    await page.getByLabel("Email").fill("riley@e2e.example");
    await page.getByLabel("Primary contact").check();
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText("Riley Synthetic")).toBeVisible();
    await expect(page.getByText("Primary", { exact: true })).toBeVisible();

    // Lead
    await page
      .getByRole("navigation", { name: "Client sections" })
      .getByRole("link", { name: /Leads/ })
      .click();
    await page.getByRole("link", { name: "New lead" }).click();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Title").fill("E2E retainer");
    await page.getByLabel("Primary contact").selectOption({ label: "Riley Synthetic" });
    await page.getByLabel("Estimated value (USD)").fill("12,500");
    await page.getByRole("button", { name: "Create lead" }).click();
    await expect(page.getByRole("heading", { name: "E2E retainer" })).toBeVisible();
    await expect(page.getByText("$12,500")).toBeVisible();

    // Move stage: Lost requires a reason; then move to Proposal.
    const stage = page.getByLabel("Stage for E2E retainer");
    await stage.selectOption({ label: "Lost" });
    await expect(page.getByRole("button", { name: "Move" })).toBeDisabled();
    await page.getByLabel("Lost reason").fill("Synthetic: budget paused");
    await page.getByRole("button", { name: "Move" }).click();
    await expectToast(page, "Moved to Lost");
    await expect(page.getByText("Synthetic: budget paused")).toBeVisible();
    await stage.selectOption({ label: "Proposal" });
    await page.getByRole("button", { name: "Move" }).click();
    await expectToast(page, "Moved to Proposal");

    // Activity
    await page.getByRole("button", { name: "Log activity" }).click();
    await page.getByLabel("Type").selectOption("meeting");
    await page.getByLabel("Subject").fill("Kickoff meeting");
    await page.getByLabel("Details").fill("Synthetic notes only.");
    await page.getByRole("button", { name: "Save activity" }).click();
    await expectToast(page, "Activity logged");
    await expect(page.getByText("Kickoff meeting")).toBeVisible();

    // Follow-up → complete
    await page.getByRole("button", { name: "Add follow-up" }).click();
    await page.getByLabel("What needs to happen?").fill("Send E2E proposal");
    await page.getByRole("button", { name: "Save follow-up" }).click();
    await expectToast(page, "Follow-up added");
    await page.getByRole("button", { name: "Mark “Send E2E proposal” done" }).click();
    await expectToast(page, "Follow-up completed");
    await expect(page.getByText("Send E2E proposal")).toHaveCount(0);

    // Pipeline shows the lead; audit has the stage changes.
    await page.goto("/pipeline?view=list");
    await expect(page.getByRole("link", { name: "E2E retainer" })).toBeVisible();
    await page.goto("/settings/audit");
    await expect(page.getByRole("cell", { name: "lead.updated" }).first()).toBeVisible();

    // Archive the client (cleanup; archived clients leave the default list).
    await gotoHydrated(page, clientUrl);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Archive" }).click();
    await expectToast(page, "Client archived");
    await page.goto(`/clients?q=${encodeURIComponent(clientName)}`);
    await expect(page.getByText("No matching clients")).toBeVisible();
  });

  test("owner can rename a pipeline stage", async ({ page }) => {
    await gotoHydrated(page, "/settings/pipeline");
    const name = page.getByLabel("Name of stage 4");
    await name.fill("Negotiation (E2E)");
    await name.locator("xpath=..").getByRole("button", { name: "Rename" }).click();
    await expectToast(page, "Stage renamed");
    await page.goto("/pipeline");
    await expect(page.getByRole("heading", { name: /Negotiation \(E2E\)/ })).toBeVisible();

    await gotoHydrated(page, "/settings/pipeline");
    await page.getByLabel("Name of stage 4").fill("Negotiation");
    await page
      .getByLabel("Name of stage 4")
      .locator("xpath=..")
      .getByRole("button", { name: "Rename" })
      .click();
    await expectToast(page, "Stage renamed");
  });
});

test.describe("as viewer", () => {
  test.use({ storageState: USERS.viewer.storage });

  test("viewer can read the CRM but not change it", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.getByRole("link", { name: "Northwind Example Bakery" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New client" })).toHaveCount(0);

    await page.getByRole("link", { name: "Northwind Example Bakery" }).click();
    await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

    await page.goto("/pipeline");
    await expect(page.getByRole("button", { name: "Move" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit stages" })).toHaveCount(0);

    for (const path of ["/clients/new", "/leads/new", "/settings/pipeline"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });
});
