import { expect, test as setup } from "@playwright/test";

import { signInFully, USERS } from "./fixtures";

// Signs in once per role and saves the session for the other specs.
// Staff land on the dashboard; client accounts land on their portal.
for (const [role, landing] of [
  ["owner", /\/dashboard$/],
  ["viewer", /\/dashboard$/],
  ["clientA", /\/portal$/],
] as const) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const user = USERS[role];
    await signInFully(page, user.email);
    await expect(page).toHaveURL(landing);
    await page.context().storageState({ path: user.storage });
  });
}
