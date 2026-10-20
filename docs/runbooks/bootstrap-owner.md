# Runbook — Bootstrap the owner (FR-AUTH-3)

Last updated: 2026-10-20

`scripts/bootstrap-owner.ts` provisions, in one idempotent run:

1. the Supabase Auth user (email confirmed, password you choose),
2. the profile (display name),
3. the workspace (by slug),
4. the owner membership.

Existing records are left untouched, so re-running is safe. Membership and workspace
creation are recorded in the audit log as `system` events.

## Local

```sh
npm run db:start
npx supabase status -o env | grep SECRET_KEY     # local secret key
```

Put these in `.env.local` (synthetic values for local testing):

```
SUPABASE_SECRET_KEY=<local secret key>
BOOTSTRAP_OWNER_EMAIL=founder@example.test
BOOTSTRAP_OWNER_DISPLAY_NAME=Synthetic Founder
BOOTSTRAP_WORKSPACE_NAME=Synthetic Agency
BOOTSTRAP_WORKSPACE_SLUG=synthetic-agency
```

Run `npm run bootstrap:owner`, enter a password (12+ characters, typed twice, hidden),
then sign in at http://localhost:3000/login and enroll your authenticator app.
**Remove `SUPABASE_SECRET_KEY` from `.env.local` afterwards.**

## Hosted project (staging / production)

Not done yet: creating hosted projects needs owner approval (decisions.md D-4, D-14).
When approved:

- The script refuses non-local URLs unless run with `npm run bootstrap:owner -- --remote`
  in an interactive terminal, and asks you to type the target host to confirm.
- Take the secret key from the Supabase dashboard (password manager), put it in
  `.env.local` only for the run, and delete it afterwards. Never paste it into chat or AI
  tools, and never commit it.
- Use your real email and the real workspace name only for production.

## Recovery: lost authenticator

There is no in-app factor reset yet (known limitation). The owner can recover through the
Supabase dashboard:

1. Supabase dashboard → Authentication → Users → select the user.
2. Delete the user's MFA factor (TOTP).
3. Sign in with email + password; the app asks you to enroll a new authenticator.

Locally the same is possible with SQL: `delete from auth.mfa_factors where user_id = '<id>';`.
For a hosted project, do this only as the owner and note it in your records; the audit log
does not cover `auth` schema changes.
