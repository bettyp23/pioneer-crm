# Hosted Pioneer (Vercel + Supabase) with the worker on your Mac

The Vercel site (`pioneer-crm-two.vercel.app`) is the real Pioneer: you use it from your phone or
laptop. The hosted Supabase project holds the real data. The worker runs on your Mac and connects
to the hosted database over TLS, as the restricted `pioneer_worker` role, so messages you write
on the site reach Pioneer (Claude) and Michael Scott while your Mac is awake. The copy on your
Mac (`npm run dev`, local database) stays for testing.

```mermaid
flowchart LR
  phone[You: phone / laptop] -->|HTTPS, MFA| vercel[Vercel: Pioneer app]
  vercel -->|your session, RLS| db[(Hosted Supabase)]
  worker[Worker on your Mac] -->|TLS verified, pioneer_worker| db
  worker --> claude[Claude scheduled task] & grok[Michael Scott webhook]
  claude & grok --> sheet[Agency Dashboard sheet]
  worker -->|read-only| sheet
```

Never paste a password, key, token or connection string into a chat.

## 1. Supabase dashboard (your project)

1. **Authentication → Sign In / Providers → Email:** turn **off** "Allow new users to sign up".
   Keep email + password on.
2. **Authentication → Multi-Factor:** TOTP **enabled**.
3. **Authentication → Password security:** minimum length **12**, leaked-password protection
   **on**.
4. **Authentication → URL Configuration:** Site URL `https://pioneer-crm-two.vercel.app`;
   redirect URLs: the same address followed by `/**`.
5. **Database → Settings → SSL configuration:** **Download certificate**, then in Terminal:
   ```bash
   mkdir -p ~/.config/pioneer && mv ~/Downloads/prod-ca-*.crt ~/.config/pioneer/supabase-ca.crt
   ```

## 2. Link this Mac to the project (Terminal, in the project folder)

```bash
npx supabase login
npx supabase link --project-ref haorcxcglsilmzqdltrc
```

`login` opens the browser. `link` asks for the database password (from your password manager;
reset it under Database settings if you don't have it). Then tell Claude Code "linked": it checks
which migrations the hosted database already has and shows you before changing anything.

## 3. Database changes (after M8 is merged)

Claude Code runs `npx supabase db push` once you approve. This applies the migrations only;
**the local sample data (`seed.sql`) is never sent to the hosted database**, because its
passwords are public.

## 4. Your owner account (once)

If you haven't signed in to the Vercel site yet: follow `docs/runbooks/bootstrap-owner.md` with
the hosted project's URL and secret key. Remove the secret key from `.env.local` afterwards.

## 5. The worker → hosted database

```bash
npm run worker:setup-hosted
```

It asks for the **Session pooler** connection string (Supabase → **Connect** → Session pooler,
with your database password filled in). You type it hidden; it's used once and not saved. The
script gives `pioneer_worker` a new random password, checks that the worker can log in with the
certificate verified, and saves only the worker's login to `.env.worker`. Then:

```bash
npm run worker
```

The first log line should say `"database":"hosted (TLS verified)"`.

## 6. Vercel settings

- **Environment variables:** only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never the Supabase secret key, and none of the worker
  settings.
- **Deployment Protection:** on for **Preview** deployments (Vercel Authentication), so branch
  previews aren't public. The production address stays reachable and is protected by your
  login and authenticator code.
- **Plan:** Vercel's Hobby plan is for non-commercial use; Pioneer runs your business, so it needs
  Pro.

## 7. Live test

On your phone: open the site → **Pioneer** → "draft a follow-up for test client" → Send. Within
a few minutes Pioneer's routing note, then Michael Scott's result, appear in the chat.

## Notes

- Supabase's free plan pauses projects after a week without activity and has no backups. For
  real client data, use the Pro plan.
- To test locally again, run `npm run worker:setup-local`; it switches `.env.worker` back to the
  local database. `npm run worker:setup-hosted` switches it to the hosted one.
