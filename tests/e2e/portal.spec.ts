import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

import {
  enterTotp,
  freshTotpCode,
  gotoHydrated,
  LOCAL_PASSWORD,
  LOCAL_PUBLISHABLE_KEY,
  LOCAL_SUPABASE_URL,
  localDbUrl,
  localSecretKey,
  signInWithPassword,
  USERS,
} from "./fixtures";

// Client portal (D-39). Client A = Northwind Example Bakery, client B = Contoso Example Dental
// (supabase/seed.sql). Proves A cannot see or change B's data in the app or by calling
// Supabase directly, and that signed-out visitors are sent to /login.

const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const RUN = Date.now().toString(36);

type ClientSeed = {
  clientId: string;
  projectId: string;
  projectName: string;
  fileId: string;
  filePath: string;
  fileTitle: string;
  approvalId: string;
  approvalTitle: string;
  requestId: string;
  requestSubject: string;
};
let A: ClientSeed;
let B: ClientSeed;

const adminClient = () =>
  createClient(LOCAL_SUPABASE_URL, localSecretKey(), { auth: { persistSession: false } });

// Runs SQL on the LOCAL database acting as the demo owner (MFA), like the seed does.
async function asOwner<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: localDbUrl() });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: OWNER_ID, role: "authenticated", aal: "aal2" }),
    ]);
    const result = await fn(db);
    await db.query("commit");
    return result;
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    await db.end();
  }
}

async function loadClient(name: string, tag: string): Promise<ClientSeed> {
  return asOwner(async (db) => {
    const client = await db.query<{ id: string }>("select id from public.clients where name = $1", [
      name,
    ]);
    const clientId = client.rows[0]!.id;
    const project = await db.query<{ id: string; name: string }>(
      "select id, name from public.projects where client_id = $1 order by created_at limit 1",
      [clientId],
    );
    const { id: projectId, name: projectName } = project.rows[0]!;
    const file = await db.query<{ id: string; storage_path: string; title: string }>(
      "select id, storage_path, title from public.client_files where client_id = $1 order by created_at limit 1",
      [clientId],
    );
    // A fresh approval and request per run, so the spec can be repeated without a db reset.
    const approvalTitle = `Approve ${tag} ${RUN}`;
    const approval = await db.query<{ id: string }>(
      "select public.create_client_approval($1, $2, $3) as id",
      [projectId, approvalTitle, `Synthetic approval for ${tag}.`],
    );
    const requestSubject = `Request ${tag} ${RUN}`;
    const request = await db.query<{ id: string }>(
      `insert into public.client_requests (client_id, project_id, kind, subject, body)
       values ($1, $2, 'question', $3, 'Synthetic request.') returning id`,
      [clientId, projectId, requestSubject],
    );
    return {
      clientId,
      projectId,
      projectName,
      fileId: file.rows[0]!.id,
      filePath: file.rows[0]!.storage_path,
      fileTitle: file.rows[0]!.title,
      approvalId: approval.rows[0]!.id,
      approvalTitle,
      requestId: request.rows[0]!.id,
      requestSubject,
    };
  });
}

test.beforeAll(async () => {
  A = await loadClient("Northwind Example Bakery", "A");
  B = await loadClient("Contoso Example Dental", "B");
  // The seed records the files; put synthetic bytes behind them (secret key: bypasses RLS).
  const storage = adminClient().storage.from("client-files");
  for (const seed of [A, B]) {
    const { error } = await storage.upload(
      seed.filePath,
      `Synthetic file for ${seed.fileTitle}\n`,
      {
        upsert: true,
        contentType: "text/plain",
      },
    );
    if (error) throw new Error(`seed upload failed: ${error.message}`);
  }
});

// ── Signed out ─────────────────────────────────────────────────────────────────
test("signed-out visitors are sent to /login from every portal and dashboard page", async ({
  page,
}) => {
  const someId = "3f0c8a6e-4b7a-4c1e-9b6a-2d3c4e5f6a7b";
  for (const path of [
    "/login/portal",
    "/login/portal/approvals",
    "/login/portal/files",
    "/login/portal/requests",
    `/login/portal/files/${someId}`,
    "/login/dashboard",
    "/login/dashboard/clients",
    `/login/dashboard/clients/${someId}`,
    `/login/dashboard/clients/files/${someId}`,
  ]) {
    await page.goto(path);
    await expect(page, `${path} redirects`).toHaveURL(/\/login$/);
  }
});

// ── Client A in the browser ────────────────────────────────────────────────────
test.describe("client A in the portal", () => {
  test.use({ storageState: USERS.clientA.storage });

  test("sees only their own project", async ({ page }) => {
    await page.goto("/login/portal");
    await expect(page.getByRole("heading", { name: "Hi, Avery" })).toBeVisible();
    await expect(page.getByRole("heading", { name: A.projectName })).toBeVisible();
    await expect(page.getByText("Northwind Example Bakery")).toBeVisible();
    await expect(page.getByText(B.projectName)).toHaveCount(0);
    await expect(page.getByText("Contoso")).toHaveCount(0);
  });

  test("answers an approval with a comment", async ({ page }) => {
    await gotoHydrated(page, "/login/portal/approvals");
    await expect(page.getByText(B.approvalTitle)).toHaveCount(0);
    const card = page.locator("[data-slot=card]", {
      has: page.getByRole("heading", { name: A.approvalTitle }),
    });
    const comment = `Looks good to us ${RUN}`;
    await card.getByLabel("Comment (optional)").fill(comment);
    await card.getByRole("button", { name: "Yes, approve" }).click();
    await expect(page.getByText("Thanks — we've got your answer.")).toBeVisible();
    const answered = page.locator("section", { hasText: "Already answered" });
    await expect(answered.getByText(A.approvalTitle)).toBeVisible();
    await expect(answered.getByText(`“${comment}”`)).toBeVisible();
  });

  test("downloads a shared file, but not client B's", async ({ page }) => {
    await page.goto("/login/portal/files");
    await expect(page.getByText(B.fileTitle)).toHaveCount(0);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: new RegExp(A.fileTitle) }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(A.filePath.split("/").pop());

    const other = await page.request.get(`/login/portal/files/${B.fileId}`, { maxRedirects: 0 });
    expect(other.status()).toBe(404);
  });

  test("submits a request and sees its status", async ({ page }) => {
    await gotoHydrated(page, "/login/portal/requests");
    await expect(page.getByText(A.requestSubject)).toBeVisible();
    await expect(page.getByText(B.requestSubject)).toHaveCount(0);
    const subject = `Portal request ${RUN}`;
    await page.getByLabel("What is it?").selectOption("change");
    await page.getByLabel("Short title").fill(subject);
    await page.getByLabel("Details").fill("Please make the logo bigger.");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Sent. We'll get back to you soon.")).toBeVisible();
    const item = page.locator("li", { hasText: subject });
    await expect(item.getByText("Received")).toBeVisible();
    await expect(item.getByText("Change request")).toBeVisible();
  });

  test("is kept out of the staff dashboard", async ({ page }) => {
    for (const path of [
      "/login/dashboard",
      "/login/dashboard/clients",
      `/login/dashboard/clients/${B.clientId}`,
    ]) {
      await page.goto(path);
      await expect(page, `${path} → portal`).toHaveURL(/\/login\/portal$/);
    }
    const file = await page.request.get(`/login/dashboard/clients/files/${B.fileId}`, {
      maxRedirects: 0,
    });
    expect(file.status()).not.toBe(200);
    expect(file.headers()["location"] ?? "").not.toContain("supabase");
  });
});

// ── Client A calling Supabase directly (publishable key + their own session) ───
async function signInAsClientA(page: Page, withMfa = true): Promise<SupabaseClient> {
  const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: USERS.clientA.email,
    password: LOCAL_PASSWORD,
  });
  if (error) throw error;
  if (withMfa) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp[0];
    if (!factor) throw new Error("client A has no TOTP factor");
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: await freshTotpCode(page),
    });
    if (mfaError) throw mfaError;
  }
  return supabase;
}

test.describe("client A calling Supabase directly", () => {
  test("cannot read client B's data", async ({ page }) => {
    const supabase = await signInAsClientA(page);

    const projects = await supabase.from("projects").select("id, client_id");
    expect(projects.error).toBeNull();
    expect(projects.data!.length).toBeGreaterThan(0);
    expect(projects.data!.every((p) => p.client_id === A.clientId)).toBe(true);

    for (const table of ["approvals", "client_files", "client_requests"] as const) {
      const all = await supabase.from(table).select("client_id");
      expect(all.error, table).toBeNull();
      expect(all.data!.length, `${table} has A's rows`).toBeGreaterThan(0);
      expect(
        all.data!.every((r) => r.client_id === A.clientId),
        `${table} only A`,
      ).toBe(true);
      const asked = await supabase.from(table).select("id").eq("client_id", B.clientId);
      expect(asked.data, `${table} filtered to B`).toEqual([]);
    }
    const tasks = await supabase.from("project_tasks").select("project_id");
    expect(tasks.data!.every((t) => t.project_id === A.projectId)).toBe(true);
    const bTasks = await supabase.from("project_tasks").select("id").eq("project_id", B.projectId);
    expect(bTasks.data).toEqual([]);

    // Staff-only tables: nothing at all (clients holds internal notes).
    for (const table of [
      "clients",
      "contacts",
      "leads",
      "workspace_members",
      "audit_events",
    ] as const) {
      const rows = await supabase.from(table).select("*").limit(5);
      expect(rows.data ?? [], table).toEqual([]);
    }
    const me = await supabase.rpc("portal_client");
    expect(me.data).toEqual([expect.objectContaining({ id: A.clientId })]);

    const storage = supabase.storage.from("client-files");
    const signed = await storage.createSignedUrl(B.filePath, 60);
    expect(signed.data).toBeNull();
    const download = await storage.download(B.filePath);
    expect(download.data).toBeNull();
    const listed = await storage.list(B.clientId);
    expect(listed.data ?? []).toEqual([]);
    const own = await storage.download(A.filePath);
    expect(own.error).toBeNull();
  });

  test("cannot change client B's data or act as staff", async ({ page }) => {
    const supabase = await signInAsClientA(page);

    const request = await supabase.from("client_requests").insert({
      client_id: B.clientId,
      kind: "change",
      subject: "Posting as B",
      body: "Should be refused",
    } as never);
    expect(request.error?.code).toBe("42501");

    const response = await supabase
      .from("approval_responses")
      .insert({ approval_id: B.approvalId, decision: "approved" } as never);
    expect(response.error?.code).toBe("42501");

    const reqUpdate = await supabase
      .from("client_requests")
      .update({ status: "done", admin_reply: "hijacked" })
      .eq("id", B.requestId)
      .select("id");
    expect(reqUpdate.data ?? []).toEqual([]);
    const ownUpdate = await supabase
      .from("client_requests")
      .update({ status: "done" })
      .eq("id", A.requestId)
      .select("id");
    expect(ownUpdate.data ?? []).toEqual([]);

    const projectUpdate = await supabase
      .from("projects")
      .update({ current_phase: "Hijacked" })
      .eq("id", B.projectId)
      .select("id");
    expect(projectUpdate.data ?? []).toEqual([]);

    const fileDelete = await supabase.from("client_files").delete().eq("id", B.fileId).select("id");
    expect(fileDelete.data ?? []).toEqual([]);

    const move = await supabase
      .from("profiles")
      .update({ client_id: B.clientId } as never)
      .eq("user_id", USERS.clientA.id);
    expect(move.error?.code).toBe("42501");
    const promote = await supabase
      .from("profiles")
      .update({ role: "admin" } as never)
      .eq("user_id", USERS.clientA.id);
    expect(promote.error?.code).toBe("42501");

    const staffFn = await supabase.rpc("create_client_approval", {
      p_project_id: B.projectId,
      p_title: "Self-made",
    });
    expect(staffFn.error?.code).toBe("42501");
    const relink = await supabase.rpc("attach_portal_user", {
      p_user_id: USERS.clientA.id,
      p_client_id: B.clientId,
      p_display_name: "Me",
    });
    expect(relink.error?.code).toBe("42501");

    const storage = supabase.storage.from("client-files");
    const upload = await storage.upload(`${B.clientId}/x/evil.txt`, "x");
    expect(upload.error).not.toBeNull();
    const ownUpload = await storage.upload(`${A.clientId}/x/evil.txt`, "x");
    expect(ownUpload.error).not.toBeNull();
    await storage.remove([B.filePath, A.filePath]);

    // Nothing changed for B (checked with the secret key, which bypasses RLS).
    const admin = adminClient();
    const bFile = await admin.storage.from("client-files").download(B.filePath);
    expect(bFile.error).toBeNull();
    const aFile = await admin.storage.from("client-files").download(A.filePath);
    expect(aFile.error).toBeNull();
    const state = await asOwner((db) =>
      db.query(
        `select (select status from public.approvals where id = $1) as approval,
                (select status from public.client_requests where id = $2) as request,
                (select current_phase from public.projects where id = $3) as phase,
                (select count(*)::int from public.client_requests where subject = 'Posting as B') as forged`,
        [B.approvalId, B.requestId, B.projectId],
      ),
    );
    expect(state.rows[0]).toMatchObject({ approval: "pending", request: "open", forged: 0 });
    expect(state.rows[0].phase).not.toBe("Hijacked");
  });

  test("without the authenticator step sees nothing", async ({ page }) => {
    const supabase = await signInAsClientA(page, false);
    for (const table of ["projects", "approvals", "client_files", "client_requests"] as const) {
      const rows = await supabase.from(table).select("id");
      expect(rows.data ?? [], table).toEqual([]);
    }
  });
});

// ── Owner: admin side and invitations ──────────────────────────────────────────
test.describe("owner manages clients", () => {
  test.use({ storageState: USERS.owner.storage });

  test("sees every client and answers a request", async ({ page }) => {
    await gotoHydrated(page, "/login/dashboard/clients");
    await expect(page.getByRole("link", { name: "Northwind Example Bakery" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Contoso Example Dental" })).toBeVisible();

    await page.getByRole("link", { name: "Contoso Example Dental" }).click();
    await expect(page.getByRole("heading", { name: "Contoso Example Dental" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const item = page.locator("li", { hasText: B.requestSubject });
    await item.getByLabel("Reply (the client sees this)").fill("Yes, we can do that.");
    await item.getByLabel("Request status").selectOption("in_progress");
    await item.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Request updated.")).toBeVisible();
  });

  test("invites a client, who sets a password and authenticator and sees only their client", async ({
    page,
    browser,
  }) => {
    const email = `invitee-${RUN}@example.test`;
    await gotoHydrated(page, `/login/dashboard/clients/${A.clientId}`);
    await page.getByLabel("Name").fill("Invited Example");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Invite sent.")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Read the invite from the local mail catcher (Mailpit).
    let link = "";
    await expect
      .poll(async () => {
        const search = await fetch(
          `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
        ).then((r) => r.json() as Promise<{ messages: { ID: string }[] }>);
        const id = search.messages[0]?.ID;
        if (!id) return "";
        const message = await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`).then(
          (r) => r.json() as Promise<{ HTML: string }>,
        );
        link = (/href="([^"]*\/login\/welcome[^"]*)"/.exec(message.HTML)?.[1] ?? "").replaceAll(
          "&amp;",
          "&",
        );
        return link;
      })
      .toContain("token_hash=");

    const context = await browser.newContext();
    const invitee = await context.newPage();
    try {
      await gotoHydrated(invitee, link);
      await expect(
        invitee.getByRole("heading", { name: "Welcome to your client portal" }),
      ).toBeVisible();
      await invitee.getByLabel("Choose a password").fill("a-long-portal-password-1");
      await invitee.getByLabel("Type it again").fill("a-long-portal-password-1");
      await invitee.getByRole("button", { name: "Save password and continue" }).click();
      await expect(invitee).toHaveURL(/\/login\/mfa$/);
      await invitee.getByRole("button", { name: "Set up authenticator app" }).click();
      const secret = (await invitee.locator("code").first().textContent())?.trim() ?? "";
      await enterTotp(invitee, await freshTotpCode(invitee, secret), "Confirm and continue");
      await expect(invitee).toHaveURL(/\/login\/portal$/);
      await expect(invitee.getByRole("heading", { name: A.projectName })).toBeVisible();
      await expect(invitee.getByText(B.projectName)).toHaveCount(0);

      // The link works once.
      await gotoHydrated(invitee, link);
      await invitee.getByLabel("Choose a password").fill("another-long-password-2");
      await invitee.getByLabel("Type it again").fill("another-long-password-2");
      await invitee.getByRole("button", { name: "Save password and continue" }).click();
      await expect(invitee.getByText(/expired or was already used/)).toBeVisible();
    } finally {
      await context.close();
      const admin = adminClient();
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const user = data?.users.find((u) => u.email === email);
      if (user) await admin.auth.admin.deleteUser(user.id);
    }
  });
});

test("a client account cannot sign in to staff pages before MFA either", async ({ page }) => {
  await signInWithPassword(page, USERS.clientB.email);
  await page.goto("/login/portal");
  await expect(page).toHaveURL(/\/login\/mfa$/);
  await page.goto("/login/dashboard/clients");
  await expect(page).toHaveURL(/\/login\/mfa$/);
});
