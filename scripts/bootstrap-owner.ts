/**
 * Pioneer OS — owner bootstrap (FR-AUTH-3). Run manually: `npm run bootstrap:owner`.
 * See docs/runbooks/bootstrap-owner.md.
 *
 * Idempotent: creates whatever is missing of
 *   auth user → profile → workspace → owner membership
 * and leaves existing records untouched. Uses the secret (service-role) key, which
 * bypasses RLS, so it is never imported by the app (ESLint boundary).
 *
 * The password is never read from env files: it is prompted (hidden) on a terminal, or read
 * from the first line of stdin when piped (local automation only).
 */
import { createInterface } from "node:readline";

import { z } from "zod";

import { createSupabaseAdminClient } from "../src/server/db/admin-client";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),
  BOOTSTRAP_OWNER_EMAIL: z.email(),
  BOOTSTRAP_OWNER_DISPLAY_NAME: z.string().trim().min(1).max(120),
  BOOTSTRAP_WORKSPACE_NAME: z.string().trim().min(1).max(120),
  BOOTSTRAP_WORKSPACE_SLUG: z.string().regex(/^[a-z0-9-]{2,40}$/),
});

type Outcome = "created" | "existing";
const MIN_PASSWORD_LENGTH = 12;

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

async function readLine(prompt: string, hidden: boolean): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Suppress echo of typed characters.
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.startsWith(prompt)) write.call(rl, prompt);
    };
  }
  const answer = await new Promise<string>((resolve) => rl.question(prompt, resolve));
  rl.close();
  if (hidden) process.stdout.write("\n");
  return answer;
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) {
      rl.close();
      return line;
    }
    fail("No password provided on stdin.");
  }
  const first = await readLine("New owner password (min 12 chars): ", true);
  const second = await readLine("Repeat password: ", true);
  if (first !== second) fail("Passwords do not match.");
  return first;
}

async function confirmRemote(url: URL) {
  const isLocal = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (isLocal) return;
  if (!process.argv.includes("--remote")) {
    fail(
      `Target ${url.host} is not local. Provisioning a hosted project requires owner ` +
        `authorization; re-run with --remote after it has been approved (decisions.md D-14).`,
    );
  }
  if (!process.stdin.isTTY) fail("Remote bootstrap must be run interactively.");
  const answer = await readLine(`Type the host to confirm (${url.host}): `, false);
  if (answer.trim() !== url.host) fail("Host confirmation did not match.");
}

async function main() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    fail(`Missing or invalid environment variables:\n${fields.join("\n")}`);
  }
  const env = parsed.data;
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  await confirmRemote(url);

  const admin = createSupabaseAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
  const email = env.BOOTSTRAP_OWNER_EMAIL.toLowerCase();
  const outcomes: Record<string, Outcome> = {};

  // 1. Auth user
  let userId: string | undefined;
  for (let page = 1; !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not list users (${error.code ?? error.status})`);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  if (userId) {
    outcomes.user = "existing";
  } else {
    const password = await readPassword();
    if (password.length < MIN_PASSWORD_LENGTH) {
      fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) fail(`Could not create user (${error?.code ?? "unknown"})`);
    userId = data.user.id;
    outcomes.user = "created";
  }

  // 2. Profile
  {
    const { data, error } = await admin
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) fail(`Could not read profile (${error.code})`);
    if (data) {
      // The owner is the 'admin' account (client portal, D-39); older profiles predate roles.
      if (data.role !== "admin") {
        const { error: roleError } = await admin
          .from("profiles")
          .update({ role: "admin" })
          .eq("user_id", userId);
        if (roleError) fail(`Could not set the owner's account role (${roleError.code})`);
      }
      outcomes.profile = "existing";
    } else {
      const { error: insertError } = await admin
        .from("profiles")
        .insert({ user_id: userId, display_name: env.BOOTSTRAP_OWNER_DISPLAY_NAME, role: "admin" });
      if (insertError) fail(`Could not create profile (${insertError.code})`);
      outcomes.profile = "created";
    }
  }

  // 3. Workspace (by slug)
  let workspaceId: string;
  {
    const { data, error } = await admin
      .from("workspaces")
      .select("id")
      .eq("slug", env.BOOTSTRAP_WORKSPACE_SLUG)
      .maybeSingle();
    if (error) fail(`Could not read workspace (${error.code})`);
    if (data) {
      workspaceId = data.id;
      outcomes.workspace = "existing";
    } else {
      const { data: created, error: insertError } = await admin
        .from("workspaces")
        .insert({ name: env.BOOTSTRAP_WORKSPACE_NAME, slug: env.BOOTSTRAP_WORKSPACE_SLUG })
        .select("id")
        .single();
      if (insertError) fail(`Could not create workspace (${insertError.code})`);
      workspaceId = created.id;
      outcomes.workspace = "created";
    }
  }

  // 4. Owner membership
  {
    const { data, error } = await admin
      .from("workspace_members")
      .select("role, status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) fail(`Could not read membership (${error.code})`);
    if (data) {
      outcomes.membership = "existing";
      if (data.role !== "owner" || data.status !== "active") {
        console.warn(
          `! Existing membership is ${data.status} ${data.role}, not active owner. ` +
            `Not changed automatically — review it deliberately.`,
        );
      }
    } else {
      const { error: insertError } = await admin
        .from("workspace_members")
        .insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
      if (insertError) fail(`Could not create membership (${insertError.code})`);
      outcomes.membership = "created";
    }
  }

  console.log(`\nPioneer OS bootstrap — ${url.host}`);
  for (const [step, outcome] of Object.entries(outcomes)) {
    console.log(`  ${outcome === "created" ? "+" : "="} ${step.padEnd(10)} ${outcome}`);
  }
  console.log(
    `\nNext: sign in at ${url.hostname === "127.0.0.1" ? "http://localhost:3000" : "the app"}` +
      `/login as ${email} and set up your authenticator app.\n` +
      `Then remove SUPABASE_SECRET_KEY from your env file.`,
  );
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
