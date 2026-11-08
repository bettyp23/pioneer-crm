# Implementation roadmap: Hermes in eight steps

Last updated 2026-11-08 (decision D-37). Replaces the earlier M8–M16 table; that version is in
git history and on the `archive/full-pioneer-os` branch.

Each step is small, runs on its own branch, and stops with evidence for the owner's approval.
Nothing merges to `main` or deploys to production without the owner's go-ahead. Until step 7
works, the chat keeps using today's connection (worker → Grok webhook → "Pioneer Results" Drive
folder → worker), so Michael stays reachable throughout.

## Where things start (verified 2026-11-08)

| Already built | Used by step |
|---|---|
| Sign-in with password + TOTP, enforced in the database (`aal2`) | 7 |
| One-page app: Dashboard = chat with Michael (`messages` table, `send_message` function) | 7 |
| Durable job queue (`jobs`, leases, retries, gave-up list) and the restricted `pioneer_worker` database role | 7 |
| Kill switch ("pause all agents") and the per-connection loop brake | 7, 8 |
| Approvals (`proposed_actions`, `private.require_approved_action`), budgets and cost ledger, append-only audit log, from M6 (tables live; screens on the archive branch) | 8 |
| Sensitive-content scan before anything leaves Pioneer (`src/lib/ai/sensitivity.ts`) | 7 |

## The steps

| # | Step | Done when | Needs from the owner | Repo work |
|---|---|---|---|---|
| 1 | **Install Hermes locally** | A normal conversation works on the Mac | Nothing to buy | `hermes/` folder: Docker Compose for OrbStack (agents run only in a container, D-32), no secrets committed, a runbook |
| 2 | **Connect OpenRouter** | Real requests succeed to a Grok model **and** a Claude model; cost shows on the OpenRouter dashboard | OpenRouter account, a key with a **monthly limit** (D-37 cap, still OPEN), a few dollars of credit | Key only in a local env file git ignores; record the chosen model IDs |
| 3 | **Create the Michael and Claude bots** | Each answers in its own role, with its own skills and model | Michael's instructions (copy from the Grok app), what Claude should do | Bot profiles, skills and model settings saved in `hermes/` (no secrets) |
| 4 | **Test collaboration** | Michael hands a review task to Claude and gets the result back | A sample task (synthetic, no client data) | A repeatable test script and the transcript as evidence |
| 5 | **Connect GitHub and Drive** | Each bot can reach only the named repos and folders, nothing else | Fine-grained GitHub token (chosen repos, least scopes); share specific Drive folders with a service account | Access list in the runbook; read-only first, write only behind step 8 approvals |
| 6 | **Provision the Hostinger VPS** | The same setup runs always-on; Mac can be off | VPS purchase, SSH key | Hardening checklist (firewall, SSH keys only, automatic updates, no open ports except SSH), Compose deploy, backups |
| 7 | **Connect Pioneer OS** | A chat message goes Pioneer → Hermes → Michael and the reply comes back into the Dashboard, authenticated both ways | Approve the cut-over | Worker sends jobs to the Hermes API instead of the Grok webhook; per-job reply token (hash stored, as today); then **delete** the old senders (`worker/senders.ts` Grok/Claude parts), Drive/Sheet readers (`worker/folder.ts`, `worker/sheet.ts`) and their `.env.worker` settings |
| 8 | **Approvals and an end-to-end test** | External or destructive actions (send email, push code, delete, spend) wait for the owner's approval in Pioneer; one full workflow passes | Which actions need approval (default: all external or destructive) | Bring back an Approvals view on the Dashboard; Hermes tools call Pioneer to request approval and may only act on an approved, unexpired action; Playwright + database tests |

## Open before starting

- **D-37 monthly OpenRouter cap**: set on the OpenRouter key and mirrored in Pioneer budgets
  (D-33 alert at 80%, stop at 100%).
- **Which Michael**: the Hermes Michael is a new bot on a Grok model via OpenRouter. The
  Grok-app Michael keeps his own memory and is retired from Pioneer at step 7.

## Definition of done (every step)

- Lint, typecheck, unit tests, pgTAP, and Playwright on a production build pass.
- Docs updated: this roadmap, decisions, and the runbook for the step.
- No real client data in tests or transcripts. No secrets in the repository or in chat.
