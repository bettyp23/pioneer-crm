# Pioneer OS setup and purchasing guide

For: the owner of Pioneer Digital. Written 2026-10-21.

**Prices.** Prices were checked on 2026-10-21 from the providers' pages and recent pricing
summaries. Each entry marks how solid its figure is. Prices and plans change, so **confirm on the
provider's page before paying**. Nothing here assumes that a subscription includes API access
unless the entry says it does.

**Secrets.** Never paste a password, API key, token or webhook secret into chat, email, a
document or a ticket. Each entry says where its secret goes. Bring back only the items listed
under "Bring back".

**Do I already have it?** This column is based only on what this project shows: earlier
conversations, the repo and local setup. You know better; correct it in
[INTEGRATIONS_CHECKLIST.md](INTEGRATIONS_CHECKLIST.md).

## Cost summary

| Service | Needed for | Essential? | Plan | Expected monthly cost |
|---|---|---|---|---|
| Supabase | M8 go-live | Essential | Pro | ~$25 (includes $10 compute credit; small apps usually land at $25–35) |
| Vercel | M8 go-live | Essential | Pro, 1 seat | $20 + usage over the included credit |
| Domain + Cloudflare DNS | M8 | Essential (domain) / optional (Cloudflare) | Cloudflare Free | domain ~$10–20/year; DNS $0 |
| GitHub | M8 (branch protection) | Essential | Pro | ~$4 (verify) |
| Sentry | M8 | Recommended | Developer (free) | $0 |
| Hostinger VPS | M11 | Essential for agents | KVM 2 (2 vCPU, 8 GB) | $8.99 on a 24-month term, **renews at $14.99** |
| OpenRouter | M10 (dev) / M11 | Essential for agents | Pay-as-you-go credits | usage, capped by you (proposed $50); 5.5% fee on credit purchases (verify) |
| Hermes Agent | M10 | Essential for agents | Open source (MIT) | $0 |
| Uptime Kuma | M15 | Recommended | Self-hosted on the VPS | $0 |
| Stripe | M12 | Essential to take payments | Standard (no monthly fee) | 2.9% + 30¢ per US card payment; Billing ~0.7% for subscriptions (verify) |
| Google Workspace | M13/M15 | Essential for client email | Business Starter | $7/user annual or $8.40 flexible |
| OpenAI API (Codex) | M14 | Essential for automated coding | API credits | usage, capped by you (proposed $30) |
| Claude (Anthropic) | optional | Optional | Use through OpenRouter; Claude Pro only for your own chat use | $0 extra / $20 if you want Claude Pro |
| Cursor | optional | Optional | Hobby (free) or Pro | $0 / $20 |

**Baseline once everything is live:** about $90–110/month fixed (Supabase, Vercel, GitHub,
VPS at its renewal price, Workspace), plus AI usage up to your caps (proposed $50 OpenRouter
+ $30 OpenAI) and Stripe fees on money you receive.

Cheaper alternatives, if you need them:

- **Vercel:** Cloudflare Pages/Workers instead (cheaper, but less smooth with Next.js).
- **Supabase:** stay on Free until the first real client data (it pauses when idle and has no backups, so not for production).
- **VPS:** KVM 1 (4 GB) at $6.49 if you start with 3 Hermes profiles and no browser tools.

---

## 1. Supabase (database, sign-in)

1. **Website:** https://supabase.com · pricing https://supabase.com/pricing
2. **Have it?** Local only. The project runs on the Supabase CLI, and no cloud project exists yet (decision D-14 is open).
3. **Essential.**
4. **Plan:** Pro for production. A Free project can serve as staging.
5. **Cost:** $25/month per organization, including $10/month compute credit (covers one Micro instance). Includes 8 GB of database, 100 GB of files and 250 GB of egress. A spend cap is on by default. Source: third-party summaries, Sept 2026 (verify).
6. **Setup:**
   1. Create an organization "Pioneer Digital" and upgrade it to Pro.
   2. Create project `pioneer-os-prod` in region **US East (N. Virginia)**, to match Vercel's `iad1`.
   3. Generate a strong database password and save it **only in your password manager**.
   4. Authentication → Providers: keep only Email. Turn off public sign-ups. Turn on TOTP MFA.
   5. Authentication → URL configuration: set the site URL to `https://os.<your-domain>`.
   6. Keep the spend cap on.
   7. Database → Backups: confirm daily backups. Point-in-time recovery is a paid add-on; decide at M8.
   8. Do not run SQL yourself. Migrations are applied from this repository in M8, with you watching.
7. **Permissions:** you are the organization owner. Invite no one else.
8. **App needs:** project URL, publishable (anon) key, and the database connection string for migrations.
9. **Where secrets go:**
   - Publishable key and URL: Vercel environment variables. They are public by design.
   - Database password: your password manager.
   - `pioneer_worker` password (M11): VPS secrets file only.
   - No service-role key is used anywhere.
10. **Verify:** `npm run bootstrap:owner -- --remote` (guarded) creates your owner account. You then sign in with 2FA at the production URL.
11. **Common failures:**
    - Wrong region, so the app is slow (recreate early if so).
    - The site URL is not set, so login emails link to localhost.
    - The free project paused. That's why production needs Pro.
12. **Test before paying?** Yes. Everything already runs locally, and a Free project works for staging.

**Bring back:** the project reference (the short ID in the dashboard URL) and the region. Not the password or keys.

## 2. Vercel (hosting the Pioneer OS app)

1. **Website:** https://vercel.com · pricing https://vercel.com/pricing
2. **Have it?** No evidence of an account.
3. **Essential.** Hobby is not allowed for commercial use.
4. **Plan:** Pro, 1 seat.
5. **Cost:** $20 per seat per month, which includes $20 of usage credit. Overages are billed, and spend limits are opt-in, so **set one** (suggested $50). Source: third-party summaries, 2026 (verify).
6. **Setup:**
   1. Sign up with GitHub.
   2. Import the `pioneer-crm` repository.
   3. Framework preset: Next.js. Function region: `iad1`.
   4. Settings → Billing: set a spend limit.
   5. Settings → Deployment Protection: protect preview deployments (Vercel Authentication).
   6. Add environment variables per environment (Production, Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and later the Sentry and Stripe keys (M12).
   7. Domains: add `os.<your-domain>`.
   8. Production deployments happen only from `main`, which is protected on GitHub.
7. **Permissions:** the Vercel GitHub app, limited to the `pioneer-crm` repository and the client repositories you choose.
8. **App needs:** the variables above, and later `CRON_SECRET` for Vercel Cron.
9. **Where secrets go:** Vercel → Project → Settings → Environment Variables, marked Sensitive.
10. **Verify:** a preview deployment builds on a pull request, and the production URL shows the login page.
11. **Common failures:**
    - A wrong environment variable name, so the app shows "Missing Supabase URL".
    - Preview deployments are public. Turn protection on.
    - Usage overage with no spend limit set.
12. **Test before paying?** Yes for builds, on Hobby with a non-commercial test. Upgrade before real use.

**Bring back:** the Vercel team name and production URL.

## 3. Domain and Cloudflare (DNS)

1. **Website:** https://www.cloudflare.com/plans/ (Free plan)
2. **Have it?** Unknown. Decision D-13, the production domain, is open.
3. **Domain:** essential. **Cloudflare:** optional. Any registrar's DNS works.
4. **Plan:** Cloudflare Free.
5. **Cost:** $0 for DNS. Domains cost about $10–20 a year, depending on the name.
6. **Setup:**
   1. Add the domain to Cloudflare and switch its nameservers at your registrar.
   2. Create `os` as a CNAME to Vercel's target. Set it to DNS only (grey cloud), as Vercel recommends.
   3. Turn on DNSSEC.
   4. Use a separate subdomain for client websites, if you host them.
7. **Permissions:** an API token only if we automate DNS later (scoped to one zone, DNS edit).
8. **App needs:** the domain name.
9. **Where secrets go:** none for now.
10. **Verify:** `https://os.<domain>` loads with a valid certificate.
11. **Common failures:** CNAME proxied by Cloudflare (orange cloud) conflicting with Vercel; nameserver change still propagating.
12. **Test before paying?** Yes. Cloudflare is free, and you can use the Vercel URL until the domain is ready.

**Bring back:** the domain name.

## 4. GitHub (code, pull requests, CI)

1. **Website:** https://github.com/pricing
2. **Have it?** **Yes.** Account `bettyp23`, private repository with branches M0–M7 pushed. The GitHub CLI on this Mac is not signed in.
3. **Essential.**
4. **Plan:** **GitHub Pro** (personal). Branch protection and rulesets on *private* repositories need Pro, Team or Enterprise ([GitHub docs](https://docs.github.com/en/enterprise-server@3.17/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)). Without them, nothing technically stops a pushed change from reaching `main`.
5. **Cost:** about $4 a month (verify on the pricing page). Actions minutes for private repositories are limited per plan (verify).
6. **Setup:**
   1. Upgrade to Pro.
   2. Repository → Settings → Rules: add a ruleset on `main` that requires a pull request, requires the CI checks to pass, blocks force pushes and blocks deletion.
   3. Turn on Dependabot alerts and secret scanning.
   4. Settings → Environments: create `production` with yourself as required reviewer (used by M8 migrations).
   5. Later (M14): create a fine-grained personal access token for the worker. Limit it to the client repositories, with only Actions: read/write, Contents: read and Pull requests: read. It needs no admin and no workflow-file edit rights. Expiry 90 days.
7. **Permissions:** listed in step 6.5. The Codex action pushes branches with GitHub's built-in `GITHUB_TOKEN`, scoped by the workflow file.
8. **App needs:** the repository owner and name, and the webhook secret (M14).
9. **Where secrets go:**
   - Worker token: VPS secrets file.
   - `OPENAI_API_KEY`: GitHub → repository → Secrets → Actions.
   - Webhook secret: Vercel environment variables.
10. **Verify:** a test pull request shows the required checks, and merging is blocked until they pass.
11. **Common failures:**
    - The ruleset doesn't apply (target branch typo).
    - The token expired, so the worker reports 401 errors.
    - An Actions minutes quota was reached.
12. **Test before paying?** Partly. Rules can be tried on a public test repository for free.

**Bring back:** "Pro active: yes/no".

## 5. Sentry (error reporting)

1. **Website:** https://sentry.io/pricing/
2. **Have it?** No.
3. **Recommended.**
4. **Plan:** Developer (free): 1 user, 5,000 errors a month.
5. **Cost:** $0. Team is $26/month on annual billing if you ever outgrow the free plan (third-party summary, verify).
6. **Setup:**
   1. Create organization `pioneer-digital` with two projects: `pioneer-os` (Next.js) and `pioneer-worker` (Node).
   2. Data region: US.
   3. Settings → Security & Privacy: turn on "Data Scrubber" and "Prevent storing IP addresses".
7. **Permissions:** none outward.
8. **App needs:** one DSN per project. DSNs are not secret but are kept in config. For source maps: an auth token with `project:releases` only.
9. **Where secrets go:** the auth token goes in Vercel environment variables.
10. **Verify:** a deliberate test error appears in Sentry, with no personal data.
11. **Common failures:** source maps not uploaded, so stack traces are unreadable; the 5,000-error quota is used up by one noisy bug.
12. **Test before paying?** Yes. It's free.

**Bring back:** "Sentry org created: yes/no".

## 6. Hostinger VPS

1. **Website:** https://www.hostinger.com/vps-hosting. Hermes template: https://www.hostinger.com/vps/docker/hermes-agent
2. **Have it?** Not confirmed. You mentioned a VPS earlier, but no plan or details are recorded.
3. **Essential** for agents running around the clock.
4. **Plan:** **KVM 2**: 2 vCPU, 8 GB RAM, 100 GB NVMe. OS: **Ubuntu 24.04 LTS** with Docker. Do not use the one-click Hermes template; installing Hermes ourselves with Docker Compose keeps control of ports and versions.
   - Sizing: Hermes's docs recommend 2–4 GB RAM and 2 cores, at least 2 GB with browser tools. The worker, MCP server and Uptime Kuma need about 1 GB more, so KVM 2 leaves headroom.
   - KVM 1 (1 vCPU, 4 GB) works for a smaller start.
5. **Cost:** KVM 2 is $8.99/month on a 24-month term and renews at $14.99. KVM 1 is $6.49 and renews at $11.99. Source: Hostinger's page, Oct 2026. Check the term and renewal price at checkout.
6. **Setup:** done together in M11 by following [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) §VPS. Your part:
   1. Buy the plan with Ubuntu 24.04 and pick a US data center.
   2. Add **your SSH public key** during setup instead of a root password.
   3. Turn on Hostinger's two-factor login for the hPanel account.
   4. Turn on automatic weekly snapshots, if offered on the plan.
7. **Permissions:** none outward.
8. **App needs:** the server's IP address and data-center location.
9. **Where secrets go:**
   - Everything runs on the server in `/opt/pioneer/secrets/*.env`, owned by the `pioneer` service user with `chmod 600`.
   - The secrets are backed up encrypted, never in Git.
10. **Verify:**
    - `ssh pioneer@<ip>` works with your key, and a password login is refused.
    - `docker compose ps` shows the services healthy.
    - The Pioneer OS worker heartbeat turns green.
11. **Common failures:**
    - Password SSH left on, so it gets brute-forced. The runbook turns it off.
    - The disk fills with Docker images. The runbook adds weekly pruning.
    - The renewal price is a surprise.
12. **Test before paying?** Yes. The whole stack runs locally in Docker (OrbStack) first, in M10.

**Bring back:** the plan name, the data-center location, the server IP, and confirmation that your SSH key was added. Never send the root password.

## 7. OpenRouter (model access for Hermes)

1. **Website:** https://openrouter.ai · pricing https://openrouter.ai/pricing · guardrails https://openrouter.ai/docs/guides/features/guardrails
2. **Have it?** No.
3. **Essential** for Hermes. One account gives access to Claude and other models.
4. **Plan:** pay-as-you-go credits.
5. **Cost:**
   - You pay model prices passed through, plus a fee when buying credits: 5.5% with an $0.80 minimum per purchase, according to third-party summaries; verify.
   - Claude model prices for reference: Sonnet 4.6 is $3 in / $15 out and Opus 4.6 is $5 / $25 per million tokens (third-party summaries of Anthropic's list prices).
   - Proposed cap: **$50/month**, which replaces the old xAI cap (D-24).
6. **Setup:**
   1. Create the account and turn on 2FA.
   2. Buy $10 of credits to start.
   3. Create **two API keys**:
      - `pioneer-dev`: monthly limit $5, for local M10 work.
      - `pioneer-prod`: monthly limit $50, with `limit_reset` monthly.
   4. Create a guardrail:
      - **provider allowlist**: Anthropic, plus OpenAI if wanted;
      - **zero data retention required**;
      - its own monthly budget as a second ceiling.
   5. Turn off "use my data for training" in privacy settings, if that setting is shown.
7. **Permissions:** keys can call models only. Do not create a Management key for the VPS.
8. **App needs:** the key, which is used only by Hermes.
9. **Where secrets go:**
   - Prod key: the Hermes `.env` on the VPS.
   - Dev key: `~/.hermes/.env` on your Mac, local only.
10. **Verify:**
    - A Hermes test run answers.
    - The OpenRouter activity page shows the call.
    - Usage appears in the Pioneer OS Usage tab once M10 records it.
11. **Common failures:**
    - The limit is reached and requests are refused. This is intended; Pioneer OS shows the job as "retry later".
    - A model isn't covered by the allowlist (404).
    - Credits expire (reportedly after one year; verify).
12. **Test before paying?** Partly. There is a free tier with daily request limits on free models, but realistic tests need about $10 of credits.

**Bring back:** "keys created with limits: yes/no" and your chosen monthly cap.

## 8. Hermes Agent (open source)

1. **Website:** https://hermes-agent.nousresearch.com/docs/ · code https://github.com/NousResearch/hermes-agent
2. **Have it?** No.
3. **Essential** as the agent runtime.
4. **Plan:** self-hosted, MIT licence. Nous Portal is not needed.
5. **Cost:** $0. You pay only for models (OpenRouter) and the VPS.
6. **Setup:** done by us in M10 (local) and M11 (VPS), using the official Docker image, one profile per role, and the settings in [ARCHITECTURE.md §4](ARCHITECTURE.md).
7. **Permissions:** see [AGENT_ROLES_AND_PERMISSIONS.md](AGENT_ROLES_AND_PERMISSIONS.md).
8. **App needs:** `API_SERVER_KEY`, a random value generated on the server, plus one MCP token per profile, issued by Pioneer OS.
9. **Where secrets go:** `/opt/pioneer/hermes/.env` (mode 600) on the VPS.
10. **Verify:**
    - `GET /health` returns OK from inside the Docker network.
    - A synthetic `agent.run` job completes end to end.
11. **Common failures:**
    - The dashboard is exposed publicly. We bind it to 127.0.0.1.
    - Approvals are set to `off`. We keep them on and deny unattended approvals.
    - Upgrades change a setting. Pin the image version and upgrade deliberately.
12. **Test before paying?** Yes, fully, locally.

**Bring back:** nothing.

## 9. Stripe (payments, invoices, subscriptions)

1. **Website:** https://stripe.com · pricing https://stripe.com/pricing
2. **Have it?** Unknown. Decision D-9, which tool issues invoices, is open. Proposed answer: Stripe.
3. **Essential** to take payments.
4. **Plan:** Standard pay-as-you-go. Stripe Billing is needed only for subscriptions (maintenance retainers).
5. **Cost:** no monthly fee. 2.9% + 30¢ per successful US card payment; +1.5% for international cards; Billing about 0.7% of subscription volume (sources disagree, 0.5–0.7%); Stripe Tax 0.5% if used. Source: Stripe US pricing via third-party summaries, Oct 2026 (verify).
6. **Setup:**
   1. Create the account in the name of Benemento Lab LLC, with business details, bank account and 2FA.
   2. Stay in **test mode** until M12 is accepted.
   3. Products: one per package in the Pioneer OS catalog. We map their IDs, so prices are not duplicated by hand.
   4. Developers → API keys: create a **restricted key**, not the secret key. Give it write access to Checkout Sessions, Customers, Invoices and Subscriptions, and read access to Prices, Products and Payment Intents. Leave everything else at None. In particular, give no Payouts, Transfers or Refunds access. Refunds stay a manual action in the Stripe dashboard (Level 3).
   5. Webhooks: endpoint `https://os.<domain>/api/webhooks/stripe` for the events `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, `customer.subscription.created`, `.updated` and `.deleted`. Copy the signing secret straight into Vercel.
7. **Permissions:** as in step 6.4.
8. **App needs:** restricted key, webhook signing secret, and the publishable key if we embed Checkout.
9. **Where secrets go:** Vercel environment variables, separate for test and live. Live keys go in Production only.
10. **Verify:**
    - The Stripe CLI `stripe trigger checkout.session.completed` in test mode creates a payment record and an onboarding job in staging.
    - A replay of the same event creates nothing new.
11. **Common failures:**
    - A wrong signing secret, so every webhook returns 400.
    - Test keys in production. The app refuses to start in that case.
    - Duplicate events. These are handled by storing the event ID once.
12. **Test before paying?** Yes. Test mode is free and complete.

**Bring back:** "account verified: yes/no", "test mode keys created: yes/no", and the D-9 decision.

## 10. Google Workspace (Gmail, Drive, Calendar)

1. **Website:** https://workspace.google.com/pricing
2. **Have it?** Unknown. The account type and sending address are still open questions.
3. **Essential** for sending client email from your domain, with the app integration.
4. **Plan:** Business Starter.
5. **Cost:** $7 per user per month on annual billing, or $8.40 on flexible billing. Source: Google help center figure as reported, Oct 2026 (verify).
6. **Setup (M13/M15):**
   1. Sign up with your domain and verify it. Create `you@domain`, plus a `hello@` alias for client email.
   2. In Google Cloud Console, create project `pioneer-os` and set the OAuth consent screen to **Internal** (Workspace only). Internal apps don't need Google's app verification.
   3. Enable the Gmail, Drive and Calendar APIs.
   4. Create an OAuth client of type Web, with redirect `https://os.<domain>/api/google/callback`.
   5. You will sign in once from Pioneer OS to grant consent.
7. **Scopes, the narrowest that work:**
   - `gmail.send` (send only, no reading the inbox);
   - `drive.file` (only files Pioneer OS creates or you pick);
   - `calendar.events` (create and edit events).

   Reading the inbox (`gmail.readonly`) is a restricted scope. It is deliberately left out until support-ticket intake needs it (M15), and gets its own decision then.
8. **App needs:** OAuth client ID and secret, and your refresh token (stored encrypted).
9. **Where secrets go:** client ID and secret in Vercel environment variables. The refresh token is encrypted in the database with a key held in Vercel (M13).
10. **Verify:** an approved test email reaches a test address, and the sent message has the action ID header.
11. **Common failures:**
    - A consumer Gmail account can't create an Internal app. Use Workspace.
    - The redirect URI doesn't match.
    - The refresh token was revoked after a password change. Reconnect from Settings.
12. **Test before paying?** Workspace has a 14-day trial (verify). An Internal app needs a Workspace account.

**Bring back:** the account type (Workspace or personal Gmail), the domain, and the sending address.

## 11. OpenAI API (Codex for the Development Agent)

1. **Website:** https://platform.openai.com. Codex GitHub Action: https://developers.openai.com/codex/github-action
2. **Have it?** No evidence.
3. **Essential** for automated coding (M14). Optional before then.
4. **Plan:** API pay-as-you-go with a monthly budget.
   - A ChatGPT Plus or Pro subscription includes Codex for **your own** interactive use, but that is separate from API billing.
   - It has not been confirmed that a ChatGPT login can be used in unattended CI. Don't rely on it.
5. **Cost:** usage-based. Proposed cap: **$30/month**, set in the OpenAI dashboard budget and in Pioneer OS.
6. **Setup:**
   1. Create the organization `Pioneer Digital` and a project `codex-ci`.
   2. Set a project budget.
   3. Create a **project-scoped key**.
   4. Add it as the GitHub Actions secret `OPENAI_API_KEY` on each client repository (or as an organization secret, if you move the repositories to an organization).
7. **Permissions:** the project key, restricted to model use.
8. **App needs:** nothing in Pioneer OS. The key lives in GitHub only.
9. **Where secrets go:** GitHub Actions secrets.
10. **Verify:** a test `workflow_dispatch` on a test repository opens a pull request with a small change.
11. **Common failures:** budget reached; the key is in the wrong repository; the workflow lacks `pull-requests: write`.
12. **Test before paying?** No. API usage needs credits; a small top-up is enough.

**Bring back:** "OpenAI project + budget created: yes/no".

## 12. Claude (Anthropic)

- **Have it?** You said you have an Anthropic account (D-10).
- **In Pioneer OS:** used through OpenRouter, so there are one key and one cap. A direct Anthropic API key is **optional**. Add it only if we later need a feature OpenRouter doesn't pass through. If added, it gets its own Pioneer OS cap (currently $50, D-21).
- **Claude Pro/Max subscriptions** are for your own chat and Claude Code use. They do not include API access.

## 13. Cursor (optional)

- https://cursor.com/pricing: Hobby is free; Pro is $20/month ($16 on annual billing), per third-party summaries.
- Only your interactive editor. Pioneer OS never depends on it.

## 14. Uptime Kuma (M15)

- https://github.com/louislam/uptime-kuma: free, self-hosted on the VPS, bound to localhost and reached by SSH tunnel.
- **Verify:** a monitor for a test site alerts Pioneer OS when the site is stopped.
- Because a dead VPS can't report itself, the Pioneer OS heartbeat watchdog (Vercel Cron) covers that case.
