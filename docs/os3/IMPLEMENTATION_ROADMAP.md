# Implementation roadmap

Replaces the earlier "Remaining milestones (M7–M11)" plan. Milestones stay small, run one at a
time, live on feature branches, and stop with evidence (tests, screenshots) for your approval.
Nothing merges to `main` or deploys to production without your explicit go-ahead.

| Phase | Milestone | Scope | Needs from you | Can start without purchases? |
|---|---|---|---|---|
| 1. Architecture, data, auth, permissions | M1–M6 | Built | Review/merge | — |
| | **M8 Release** | Merge M1–M7; Supabase Pro + Vercel Pro production; staging; domain; GitHub ruleset; Sentry; Vercel Cron for routines; backup and restore test; production owner bootstrap | Supabase, Vercel, domain, GitHub Pro, merge approval | No (the go-live part) |
| 2. Hermes, jobs, agents, audit | **M7 Agent Center foundation** | **Built:** 3.0 roster, Grok removed, kill switch, durable job queue, worker role, Jobs tab | Confirm roster and caps | Yes |
| | M9 Autonomy policy | Levels 1–3, `autonomy_rules`, Level-3-only types, risk/justification/artifacts on approvals, "request changes", workflow runs, hash-chained audit | Your Level 2 wish list | Yes |
| | M10 Hermes bridge (local) | `pioneer-mcp` server, `pioneer-worker` service, `agent_tools`/`agent_tokens`/`agent_runs`, Docker Compose with Hermes (OrbStack), usage recording, end-to-end synthetic `agent.run` | OpenRouter `pioneer-dev` key ($5 limit) | Yes, plus $10 of OpenRouter credits |
| | M11 VPS go-live | Hostinger VPS hardening, Compose deploy, DB logins, heartbeat watchdog, backups, optional Telegram gateway | VPS, prod OpenRouter key, M8 done | No |
| 3. Sales, Stripe, CRM, onboarding | M12 Stripe and finance | Webhook ingest, payment verification, payments, subscriptions, invoices sync, expenses, profitability views, W1, W10 | D-9 = Stripe, Stripe test keys | Yes (test mode) |
| | M13 Sales and onboarding | Intake forms, lead sources, proposals from packages, message templates, Gmail send, Drive folders, Calendar, W2, W7 | Workspace, OAuth client, templates, qualification rules | Partly (without Google) |
| 4. GitHub, Codex, QA | M14 Dev pipeline | Repositories, pull requests, CI, previews, QA results, Codex GitHub Action, W3–W5, production deploy approvals | OpenAI project key, chosen repositories, GitHub token | Partly (test repository) |
| 5. Communications, maintenance, monitoring | M15 | Uptime Kuma, Sentry alerts → incidents, support tickets, SLA, maintenance plans and reports, W6, W8, W9 | Sites list, maintenance allowlist, inbox decision | Partly |
| 6. Self-improvement and reporting | M16 | Executive dashboard (revenue, expenses, margins, incidents, AI spend), knowledge base, versioned skills in GitHub, evaluation sets and runs, improvement proposals, model routing, W11, W12 | Review cadence | Yes |

## Order and why

M7 (done) → **M9** (no purchases, and it makes every later workflow safe) → **M10** (local
Hermes; proves the integration before buying the VPS) → **M8** whenever you have bought the
hosting (it can run in parallel; it is mostly setup) → M11 → M12 → M13 → M14 → M15 → M16.

If you want agents earlier, M10 can follow M7 directly. M9's rules are then stubbed so that
everything is Level 3, which is safe but means more clicks.

## Rough effort

Each milestone is one to three working sessions, the same size as M1–M6. M10 and M14 are the
largest because they add new services.

## Definition of done (every milestone)

- Lint, format, typecheck, unit tests, database lint, pgTAP, Playwright on a production build,
  and `npm audit` show 0 production vulnerabilities.
- A migration upgrade test from the previous milestone's data.
- Docs updated: schema, decisions, and the relevant 3.0 docs.
- Visual check of new screens.
- No real client data in fixtures. No secrets in the repository.
