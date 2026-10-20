import { expect, test as setup } from "@playwright/test";

import { signInFully, USERS } from "./fixtures";

// Signs in once per role and saves the session for the other specs.
for (const role of ["owner", "viewer"] as const) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const user = USERS[role];
    await signInFully(page, user.email);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.context().storageState({ path: user.storage });
  });
}
