import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { freshTotpCode, gotoHydrated, LOCAL_PASSWORD, USERS } from "./fixtures";

// M4 acceptance: SOW → generate → blocked transitions → approval gating → inputs →
// cancellation (D-7) → idempotent generation under concurrent double-submit.

const unique = () => Date.now().toString(36);
const SUPABASE_URL = "http://127.0.0.1:54321";
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

function taskRow(page: Page, title: string) {
  return page.getByRole("listitem").filter({ has: page.getByText(title, { exact: true }) });
}

test.describe("as owner", () => {
  test.use({ storageState: USERS.owner.storage });

  test("SOW → generate → tasks, approval, inputs, cancellation", async ({ page }) => {
    const id = unique();
    page.on(
      "dialog",
      (d) => void d.accept(d.type() === "prompt" ? "Synthetic: descoped" : undefined),
    );

    // Signed SOW for Contoso (synthetic seed client)
    await page.goto("/clients");
    await page.getByRole("link", { name: "Contoso Example Dental" }).click();
    await page.waitForURL(/clients\/[0-9a-f-]{36}$/);
    const clientUrl = page.url();
    const clientId = clientUrl.split("/").pop()!;
    await gotoHydrated(page, `${clientUrl}?tab=sows`);
    await page.getByRole("button", { name: "Add SOW" }).click();
    await page.getByLabel("Title").fill(`E2E SOW ${id}`);
    await page.getByLabel("Google Drive link").fill("https://drive.google.com/file/d/e2e-sow");
    await page.getByRole("button", { name: "Save SOW" }).click();
    await expectToast(page, "SOW added");
    const sowRow = page.getByRole("listitem").filter({ hasText: `E2E SOW ${id}` });
    await sowRow.getByRole("button", { name: "Record signature" }).click();
    await page.getByLabel("Client signatory").fill("Jordan Example");
    await page.getByRole("button", { name: "Confirm signature" }).click();
    await expectToast(page, "Signature recorded");
    await expect(sowRow.getByText("Signed", { exact: true })).toBeVisible();

    // Generate
    await gotoHydrated(page, `/projects/new?client=${clientId}`);
    const sowSelect = page.getByLabel("2. Signed SOW");
    const sowValue = await sowSelect
      .locator("option", { hasText: `E2E SOW ${id}` })
      .getAttribute("value");
    await sowSelect.selectOption(sowValue!);
    await page.getByLabel("4. Project name").fill(`E2E Project ${id}`);
    await page.getByRole("button", { name: "Generate project" }).click();
    await expect(page.getByRole("heading", { name: `E2E Project ${id}` })).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Kickoff: todo → in progress → review → done
    await taskRow(page, "Kickoff call")
      .getByRole("button", { name: "Start: Kickoff call" })
      .click();
    await expectToast(page, "“Kickoff call” updated");
    await taskRow(page, "Kickoff call")
      .getByRole("button", { name: "Send to review: Kickoff call" })
      .click();
    await expect(taskRow(page, "Kickoff call").getByText("In review")).toBeVisible();
    await taskRow(page, "Kickoff call")
      .getByRole("button", { name: "Mark done: Kickoff call" })
      .click();
    await expect(taskRow(page, "Kickoff call").getByText("Done", { exact: true })).toBeVisible();

    // Sitemap needs client approval before done
    const sitemap = () => taskRow(page, "Sitemap and wireframes");
    await sitemap().getByRole("button", { name: "Start: Sitemap and wireframes" }).click();
    await expect(sitemap().getByText("In progress")).toBeVisible();
    await sitemap().getByRole("button", { name: "Send to review: Sitemap and wireframes" }).click();
    await expect(
      sitemap().getByRole("button", { name: "Mark done: Sitemap and wireframes" }),
    ).toBeDisabled();

    // Build is blocked by the sitemap and the brand files input
    await expect(
      taskRow(page, "Build pages").getByText(
        /Waiting on: Sitemap and wireframes, Logo and brand files/,
      ),
    ).toBeVisible();
    await expect(
      taskRow(page, "Build pages").getByRole("button", { name: "Start: Build pages" }),
    ).toBeDisabled();

    // Approve the sitemap (client approval with evidence)
    await page
      .getByRole("navigation", { name: "Project sections" })
      .getByRole("link", { name: /Approvals/ })
      .click();
    await page.waitForLoadState("networkidle");
    const approval = page
      .getByRole("listitem")
      .filter({ hasText: "Approve: Sitemap and wireframes" });
    await approval.getByRole("button", { name: "Record decision" }).click();
    await approval.getByLabel("Client contact").selectOption({ label: "Jordan Example" });
    await approval
      .getByLabel("Evidence link")
      .fill("https://drive.google.com/file/d/e2e-approval-email");
    await approval.getByRole("button", { name: "Approve" }).click();
    await expectToast(page, /approved/);
    await expect(approval.getByText("Approved", { exact: true })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Project sections" })
      .getByRole("link", { name: /Tasks/ })
      .click();
    await page.waitForLoadState("networkidle");
    await sitemap().getByRole("button", { name: "Mark done: Sitemap and wireframes" }).click();
    await expect(sitemap().getByText("Done", { exact: true })).toBeVisible();
    await expect(
      taskRow(page, "Build pages").getByText(/Waiting on: Logo and brand files/),
    ).toBeVisible();

    // Receive and accept the input → Build can start
    await page
      .getByRole("navigation", { name: "Project sections" })
      .getByRole("link", { name: /Client inputs/ })
      .click();
    await page.waitForLoadState("networkidle");
    const brand = page.getByRole("listitem").filter({ hasText: "Logo and brand files" });
    await brand.getByRole("button", { name: "Record received" }).click();
    await brand
      .getByLabel(/Drive link for/)
      .fill("https://drive.google.com/drive/folders/e2e-brand");
    await brand.getByRole("button", { name: "Save" }).click();
    await expectToast(page, "recorded");
    await brand.getByRole("button", { name: "Accept" }).click();
    await expectToast(page, "accepted");

    await page
      .getByRole("navigation", { name: "Project sections" })
      .getByRole("link", { name: /Tasks/ })
      .click();
    await page.waitForLoadState("networkidle");
    await expect(
      taskRow(page, "Build pages").getByRole("button", { name: "Start: Build pages" }),
    ).toBeEnabled();

    // D-7: cancelling Build (prompt for reason + confirm listing Launch) unblocks Launch's task dependency
    await taskRow(page, "Build pages")
      .getByRole("button", { name: "Cancel task: Build pages" })
      .click();
    await expect(
      taskRow(page, "Build pages").getByText("Cancelled", { exact: true }),
    ).toBeVisible();
    await expect(taskRow(page, "Launch").getByText(/Waiting on: Hosting access/)).toBeVisible();
    await expect(taskRow(page, "Launch").getByText(/Waiting on: .*Build pages/)).toHaveCount(0);

    // Audit trail
    await page.goto("/settings/audit");
    await expect(page.getByRole("cell", { name: "project.generated" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "approval.updated" }).first()).toBeVisible();
  });

  test("concurrent double-submit creates exactly one project (FR-PRJ-2)", async ({ page }) => {
    const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    });
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: USERS.owner.email,
      password: LOCAL_PASSWORD,
    });
    expect(signInError).toBeNull();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factors!.totp[0]!.id,
      code: await freshTotpCode(page),
    });
    expect(mfaError).toBeNull();

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("name", "Sam Example Consulting")
      .single();
    const { data: version } = await supabase
      .from("blueprint_versions")
      .select("id")
      .eq("status", "published")
      .limit(1)
      .single();
    const key = crypto.randomUUID();
    const name = `E2E Concurrent ${unique()}`;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        supabase.rpc("generate_project", {
          p_client_id: client!.id,
          p_blueprint_version_id: version!.id,
          p_name: name,
          p_start_on: "2026-11-02",
          p_idempotency_key: key,
          p_no_sow_reason: "Synthetic: concurrency test",
        }),
      ),
    );
    for (const r of results) expect(r.error).toBeNull();
    expect(new Set(results.map((r) => r.data)).size).toBe(1);

    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("name", name);
    expect(count).toBe(1);
    const { count: taskCount } = await supabase
      .from("project_tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", results[0]!.data);
    expect(taskCount).toBe(4);
  });
});

test.describe("as viewer", () => {
  test.use({ storageState: USERS.viewer.storage });

  test("viewer can follow projects but not change them", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("link", { name: "Northwind website" }).click();
    await expect(page.getByText("Sitemap and wireframes", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Start:/ })).toHaveCount(0);
    await expect(page.getByLabel("Project status")).toHaveCount(0);
    const response = await page.goto("/projects/new");
    expect(response?.status()).toBe(404);
  });
});
