# Client portal — going live (D-39)

The portal is built and tested locally. Nothing below has been done on the hosted project.
It goes live on the **VPS at `https://os.pioneerdigitalai.com`** (portal at
`/login/portal`, admin at `/login/dashboard/clients`). Vercel is not part of this plan.

Do the steps in order. **Stop before each step for the owner's OK.** No DNS change, no change
to the public pioneerdigitalai.com site, and no change to other VPS services is part of any
step unless the owner says so at that moment.

## 0. Prerequisite: Next.js 16.4.6

Merge the Next.js upgrade PR (#19) before or with the portal PR (#18). It fixes the moderate
`npm audit` advisory for next 16.4.2.

## 1. Database (hosted Supabase project `haorcxcglsilmzqdltrc`)

1. Apply migration `20261122000100_client_portal.sql` (`npx supabase db push` against the
   linked project). It:
   - adds `profiles.role` (existing workspace members become `admin`), `client_id`, `email`;
   - makes authenticator apps optional for client accounts (`private.is_mfa()`), still
     required for admins;
   - adds client read policies on `projects`, `project_tasks`, `approvals`;
   - creates `client_files`, `client_requests`, `approval_responses` with RLS;
   - creates the private Storage bucket `client-files` (50 MB per file) and its policies.
2. Never run `seed.sql` on hosted.

## 2. Email sender (custom SMTP) and Auth settings (Supabase dashboard → Authentication)

Supabase's built-in sender allows only a few emails an hour and is meant for testing. Set up
a real sender first, because invites and password resets depend on it.

- **Sender: Resend (recommended).** Cloudflare Email Routing only receives and forwards mail;
  it isn't an SMTP server Supabase can send through.
  1. In Resend, add the sending domain (for example `pioneerdigitalai.com` or a subdomain such
     as `mail.pioneerdigitalai.com`). Resend shows the DNS records (SPF/DKIM) to add.
     **Adding those records in Cloudflare is a DNS change: the owner does it or approves it.**
     A subdomain keeps them apart from the main site's mail records.
  2. Create a Resend API key with "sending access" only. It goes straight into the Supabase
     dashboard below; don't paste it in chat or commit it.
  3. Supabase → Authentication → Emails → SMTP settings: host `smtp.resend.com`, port `465`,
     username `resend`, password = the Resend API key, sender e.g.
     `portal@pioneerdigitalai.com`, sender name "Pioneer Digital AI".
  4. Authentication → Rate limits: raise "emails sent per hour" to what you need (e.g. 30).
- **URL configuration → Site URL**: `https://os.pioneerdigitalai.com`. Email links are built
  as `<Site URL>/login/welcome?...` and `<Site URL>/login/reset-password?...`.
- **Email templates**:
  - Invite user: paste `supabase/templates/invite.html`; subject "Your Pioneer Digital AI
    client portal".
  - Reset password: paste `supabase/templates/recovery.html`; subject "Reset your Pioneer
    Digital AI password".
- Keep public sign-ups off.

## 3. VPS environment and deploy (`os.pioneerdigitalai.com`)

The owner confirms how the app runs on the VPS (process manager, reverse proxy, app user and
directory) before this step. Then:

1. Create or extend the app's `.env` file on the VPS (owned by the app's user, `chmod 600`,
   never in git):
   - `NEXT_PUBLIC_SUPABASE_URL=https://haorcxcglsilmzqdltrc.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...` (public key; needed at **build** time)
   - `SUPABASE_SECRET_KEY=...` (server-only; used only to send invites, by
     `src/server/auth/portal-invites.ts`). Without it the app works but "Send invite" is
     hidden.

   The owner types the keys into the file on the VPS; they never go in chat or commits.
2. `npm ci && npm run build && npm run start` (or the VPS's process manager equivalent),
   behind the existing reverse proxy, which must pass the original `Host` header and
   `X-Forwarded-Proto: https`. Only the app's own service is touched.
3. `next.config.ts` already allows Server Actions from `os.pioneerdigitalai.com`, and sign-out
   trusts `https://os.pioneerdigitalai.com`.

## 4. Smoke test

1. Sign in as the owner (password + authenticator code) → Clients → add a test client →
   invite your own second email address.
2. Open the email, set a password, choose "Skip for now" at the authenticator step → you land
   on `/login/portal`.
3. Account → set up an authenticator, sign out, sign in again: the code is asked for.
4. Sign out → "Forgot your password?" → reset via the email (with the code).
5. As owner: add a project, ask for an approval, share a file, answer a request; check each
   appears in the portal. Then remove the test account's access.

## Operations

- **Remove access**: client page → Portal access → Remove access (keeps the account, unlinks it).
- **Client forgot their password**: they use "Forgot your password?" on the sign-in page.
  Accounts with an authenticator also need its code to finish.
- **Client lost their authenticator**: Supabase dashboard → Authentication → user → delete the
  MFA factor; they can then sign in with just the password and add a new one from Account.
- **Admin accounts** always need the authenticator code; the portal's optional setup never
  applies to them.
