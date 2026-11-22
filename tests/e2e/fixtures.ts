import { execSync } from "node:child_process";

import { expect, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

// Synthetic users from supabase/seed.sql. LOCAL ONLY — these credentials are public.
export const LOCAL_PASSWORD = "local-dev-password";
export const LOCAL_TOTP_SECRET = "PIONEERLOCALDEVTOTPSECRET234567A";

export const USERS = {
  owner: { email: "owner@example.test", name: "Demo Owner", storage: "tests/e2e/.auth/owner.json" },
  viewer: {
    email: "viewer@example.test",
    name: "Demo Viewer",
    storage: "tests/e2e/.auth/viewer.json",
  },
  enroll: {
    email: "enroll@example.test",
    name: "Demo Enrollee",
    id: "00000000-0000-4000-8000-000000000003",
  },
  outsider: { email: "outsider@example.test", name: "Demo Outsider" },
  // Client portal accounts: A = Northwind Example Bakery, B = Contoso Example Dental.
  clientA: {
    email: "clienta@example.test",
    name: "Avery Example",
    id: "00000000-0000-4000-8000-000000000005",
    storage: "tests/e2e/.auth/client-a.json",
  },
  clientB: {
    email: "clientb@example.test",
    name: "Jordan Example",
    id: "00000000-0000-4000-8000-000000000006",
  },
} as const;

export const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
export const LOCAL_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

// Local stack's secret key, read from the running stack rather than committed.
export function localSecretKey(): string {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;
  const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8" })) as {
    SECRET_KEY?: string;
  };
  if (!status.SECRET_KEY) throw new Error("Local Supabase is not running (npm run db:start)");
  return status.SECRET_KEY;
}

// Local stack's direct database URL (test cleanup only; never a hosted database).
export function localDbUrl(): string {
  const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8" })) as {
    DB_URL?: string;
  };
  if (!status.DB_URL?.includes("127.0.0.1")) throw new Error("Local Supabase is not running");
  return status.DB_URL;
}

export function totpCode(secret: string = LOCAL_TOTP_SECRET): string {
  return new OTPAuth.TOTP({ secret }).generate();
}

// Supabase Auth rejects a TOTP code already used in the same 30-second step (per factor),
// so wait for a fresh step when this secret's current one was used or is about to expire.
const lastStepUsed = new Map<string, number>();
export async function freshTotpCode(page: Page, secret: string = LOCAL_TOTP_SECRET) {
  const step = () => Math.floor(Date.now() / 30_000);
  const remaining = () => 30_000 - (Date.now() % 30_000);
  if (lastStepUsed.get(secret) === step() || remaining() < 3_000) {
    await page.waitForTimeout(remaining() + 250);
  }
  lastStepUsed.set(secret, step());
  return totpCode(secret);
}

// Client forms must hydrate before typing, or React can reset the input mid-fill.
export async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

export async function signInWithPassword(page: Page, email: string) {
  await gotoHydrated(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(LOCAL_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login\/mfa$/);
}

export async function enterTotp(page: Page, code: string, submit: string = "Verify") {
  await page.getByLabel("Authentication code").pressSequentially(code);
  await page.getByRole("button", { name: submit }).click();
}

export async function signInFully(page: Page, email: string) {
  await signInWithPassword(page, email);
  await enterTotp(page, await freshTotpCode(page));
}
