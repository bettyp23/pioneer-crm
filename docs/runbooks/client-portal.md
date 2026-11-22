# Client portal — going live (D-39)

The portal is built and tested locally. Nothing below has been done on the hosted project.
Each step needs the owner's go-ahead (no `db push` or Vercel change without it).

## 1. Database (hosted Supabase)

1. Apply migration `20261122000100_client_portal.sql` (`npx supabase db push` against the
   linked project, after approval). It:
   - adds `profiles.role` (existing workspace members become `admin`), `client_id`, `email`;
   - adds client read policies on `projects`, `project_tasks`, `approvals`;
   - creates `client_files`, `client_requests`, `approval_responses` with RLS;
   - creates the private Storage bucket `client-files` (50 MB per file) and its policies.
2. Never run `seed.sql` on hosted.

## 2. Auth settings (Supabase dashboard → Authentication)

- **URL configuration → Site URL**: the public origin of the app (today
  `https://pioneerdigitalai.com`). The invite link is `<Site URL>/login/welcome?...`.
- **Email templates → Invite user**: paste `supabase/templates/invite.html`; subject
  "Your Pioneer Digital AI client portal".
- **SMTP**: Supabase's built-in mailer is rate limited and for testing only. Set up custom SMTP
  (e.g. the domain's mail provider) before inviting real clients.
- Keep public sign-ups off.

## 3. Vercel environment (project `pioneer-crm`, Demos team)

- Add `SUPABASE_SECRET_KEY` (Production, **Sensitive**, no `NEXT_PUBLIC_` prefix). Without it
  the app works but the "Send invite" form is hidden.

## 4. Smoke test after deploy

1. Sign in as the owner → Clients → add a test client → invite your own second email.
2. Open the email, set a password, set up the authenticator → you land on `/login/portal`.
3. As owner: add a project, ask for an approval, share a file, answer a request; check each
   appears in the portal. Then remove the test account's access.

## Operations

- **Remove access**: client page → Portal access → Remove access (keeps the account, unlinks it).
- **Client lost their authenticator / password**: Supabase dashboard → Authentication →
  user → delete the MFA factor or send a password reset; they re-enroll on next sign-in.
