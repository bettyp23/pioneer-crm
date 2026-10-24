import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  enterTotp,
  freshTotpCode,
  gotoHydrated,
  localSecretKey,
  LOCAL_PASSWORD,
  signInFully,
  signInWithPassword,
  totpCode,
  USERS,
} from "./fixtures";

// FR-AUTH-1, FR-AUTH-2, FR-AUTH-4

test("unauthenticated visitors are redirected to /login", async ({ page }) => {
  for (const path of ["/", "/dashboard", "/settings/workspace", "/settings/audit"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("wrong password shows a generic error", async ({ page }) => {
  await gotoHydrated(page, "/login");
  await page.getByLabel("Email").fill(USERS.owner.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("[data-slot=alert]")).toHaveText(
    "Sign-in failed. Check your email and password and try again.",
  );

  // Unknown account → identical message (no account enumeration).
  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByLabel("Password").fill(LOCAL_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("[data-slot=alert]")).toHaveText(
    "Sign-in failed. Check your email and password and try again.",
  );
});

test("password alone does not reach the app (aal1)", async ({ page }) => {
  await signInWithPassword(page, USERS.owner.email);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\/mfa$/);
});

test("wrong TOTP code is rejected", async ({ page }) => {
  await signInWithPassword(page, USERS.owner.email);
  const wrong = totpCode() === "000000" ? "111111" : "000000";
  await enterTotp(page, wrong);
  await expect(page.locator("[data-slot=alert]")).toContainText("That code didn't work");
  await expect(page).toHaveURL(/\/login\/mfa$/);
});

test("password + TOTP signs in to the dashboard, then sign-out ends the session", async ({
  page,
}) => {
  await signInFully(page, USERS.owner.email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: `Welcome, ${USERS.owner.name}` })).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("public sign-up is disabled", async () => {
  const supabase = createClient(
    "http://127.0.0.1:54321",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
    { auth: { persistSession: false } },
  );
  const { error } = await supabase.auth.signUp({
    email: "signup-attempt@example.test",
    password: "a-long-enough-password-1",
  });
  expect(error?.message).toMatch(/signups not allowed/i);
});

test("a signed-in user without membership sees the no-access page", async ({ page }) => {
  await signInFully(page, USERS.outsider.email);
  await expect(page).toHaveURL(/\/no-access$/);
  await expect(page.getByRole("heading", { name: "No workspace access" })).toBeVisible();
});

test("first sign-in enrolls an authenticator app", async ({ page }) => {
  // Reset the enrollee's factors so the test is repeatable (local admin key only).
  const admin = createClient("http://127.0.0.1:54321", localSecretKey(), {
    auth: { persistSession: false },
  });
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: USERS.enroll.id });
  for (const factor of factors?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: USERS.enroll.id });
  }

  await signInWithPassword(page, USERS.enroll.email);
  await expect(page.getByRole("heading", { name: "Set up two-step verification" })).toBeVisible();
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await expect(page.getByAltText("QR code for your authenticator app")).toBeVisible();

  const secret = (await page.locator("code").first().textContent())?.trim() ?? "";
  expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  await enterTotp(page, await freshTotpCode(page, secret), "Confirm and continue");
  await expect(page).toHaveURL(/\/dashboard$/);
});
