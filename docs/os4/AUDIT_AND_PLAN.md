# Pioneer OS: audit against the 18-feature list, and revised plan

Status: **Draft for owner review** · 2026-10-24 · Branch `docs/os4-plan`

> **Later the same day:** §3 Q1/Q2 were revised. The brain inside Pioneer is **Pioneer (Claude)**,
> not "Michael (Pioneer)"; Michael Scott (Grok) leads the Grok bots; there are no separate Pioneer
> role agents for now; caps alert at 80% and stop at 100%; Claude runs on the owner's subscription
> through a scheduled task. See D-29, D-30, D-33 and D-35 in `docs/decisions.md`, which win where
> this page differs.

This compares your 18-feature list (2026-10-24) with what exists today. Your answers are in §3.
When you approve this plan, it is folded into `docs/os4/PLAN.md`, so there is one plan.

**How this was checked:** code and migrations on branch `docs/os4-plan` (contains M1–M7), and a
signed-in walk through the local site as `owner@example.test` (dashboard, agents roster, queue,
actions, jobs, usage, approvals, routines, projects, clients, audit log). No console errors on any
of those pages. Nothing was changed in the app.

---

## 1. Feature-by-feature audit

Status: **Built** = works today · **Partial** = foundation exists, the feature does not ·
**Missing** = nothing yet.

| # | Feature | Status | What exists today | Where it is off |
|---|---|---|---|---|
| 1 | Central AI Commander (Michael) | **Missing** | Nothing. Your Michael Scott record was renamed "Operations Agent" in M7 | No commander, no delegation. The 4.0 draft puts **Claude** on top and Michael under it, which is the opposite of your list (Q1) |
| 2 | Specialized agents | **Partial** | 8 agent records (Operations, Sales, Client Onboarding, Development, QA & Security, Marketing & SEO, Client Success, Finance & Admin) | They are cards only. None of them run. No Claude agent, no Documentation agent, no separate Security agent. Your 11 Grok bot names are gone (Q2) |
| 3 | Agent skills | **Partial** | Per agent: one free-text instructions field + allowed work types | 6 of 8 agents show "No instructions yet". No reusable skill library that several agents share, no versioning |
| 4 | Agent routines | **Partial** | Routines page: schedules, due/missed, 90-day compliance | These are **checklists for you**. A routine cannot assign work to an agent or start anything by itself |
| 5 | Security restrictions | **Partial** (strong base) | MFA login, database row security, CSP, append-only audit, agents hold no keys, "Pause all agents" kill switch | Nothing yet controls what an agent may **do on a computer**: no command allowlist, no download/malware blocking, no secrets scanning. Needed before #16 runs anything on your Mac |
| 6 | Approval system | **Partial** | Approval Center (`/agents/actions`): approve/reject/cancel; project approvals (`/approvals`) | Approval is tied to a free-text description, not the exact payload, so what runs could differ from what you approved. No autonomy settings ("adjustable later") |
| 7 | Codebase audits | **Missing** | CI runs lint, format, typecheck | No duplication, architecture or maintainability checks, and no agent that runs them |
| 8 | Performance monitoring | **Missing** | Diagnostics and Issues pages, filled in **by hand** for client sites | No measurement of memory leaks, slow code, slow queries or database health |
| 9 | Automated testing | **Built for Pioneer itself** | 167 unit, 342 database, 31 end-to-end tests; CI workflow runs them all | Not connected to agent work: nothing makes an agent's change pass tests before you see it. Whether CI actually runs on GitHub is **unverified** (GitHub CLI is not signed in on this Mac) |
| 10 | Agent communication | **Missing** | Work queue: you copy context to an agent and paste the answer back | No worker, so no agent can hand work to another. Job queue exists but **nothing runs jobs** |
| 11 | Activity logs | **Partial** | Audit log (110 events), job attempt history | Agents don't act yet, so there is nothing of theirs to log. No per-agent activity view |
| 12 | Cost controls | **Partial** | Monthly cap per provider, spend bar, cost ledger | Costs are **typed in by hand**. No per-agent or per-task limits, no model choice per task. Grok (xAI) is blocked in the database |
| 13 | GitHub integration | **Partial** | Repo `bettyp23/pioneer-crm`, CI file, 8 feature branches | `main` holds only the initial commit; M1–M7 are unmerged. Branch protection unknown. The app itself has no GitHub connection |
| 14 | Document integration | **Minimal** | A statement of work can store a Google Drive link | No Google Drive, Sheets or Dropbox connection. Nothing is read from them as a source of truth |
| 15 | Continuous improvement | **Missing** | — | No way for agents to propose improvements to themselves or the system |
| 16 | Local-first execution | **Partial** | The whole app and database run on your Mac (OrbStack + local Supabase) | The worker that would run agents does not exist yet. Matches the 4.0 draft (worker on your Mac first) |
| 17 | Pioneer OS dashboard | **Partial** | Dashboard tiles: follow-ups, pipeline, ready tasks, approvals, routines, issues | Business side only. No agent status, running jobs, AI actions waiting or spend this month. Sidebar shows only "Work queue" under Agents |
| 18 | Client workspaces | **Mostly built** | Client page with tabs: contacts, leads, projects, SOWs, invoices, issues, activity, follow-ups | No documents area beyond SOW links; agent work for a client isn't shown there |

### Other things noticed on the site

- The **Usage** page still says costs are recorded automatically "once Hermes is connected", but
  Hermes was postponed. The text is out of date.
- The local database contains leftover test records ("E2E Concurrent mvlmfch3", etc.) from test
  runs. Only cosmetic; `npm run db:reset` clears them.
- The sidebar navigation code still says `CURRENT_MILESTONE = 6`.

---

## 2. Where your list differs from the 4.0 draft plan

| Topic | 4.0 draft (`PLAN.md`) | Your new list | Proposed |
|---|---|---|---|
| Who is in charge | Claude orchestrates; Michael coordinates web dev only | **Michael** commands everything and delegates to Claude | Follow your list (Q1) |
| Agents | Your 11 Grok bots | Roles: Claude, developers, QA, security, documentation, operations | Q2 |
| Execution security on your Mac | Not covered | Explicit: no unsafe downloads, commands, secrets | New phase **S** (below), before any agent touches your computer |
| Code audits, performance, testing gates | Only in P5 (coding worker) | Core features | New phase **Q** |
| Dropbox, Sheets | Google Drive only, P4 | Drive, Sheets, Dropbox | Read-only, folder-limited connections |
| Self-improvement | "Later" | Agents propose, never self-modify | Proposals queue (phase **I**) |
| Chat, iPhone app, Website Demo protocol | P2, P4, P6 | Not mentioned | Kept, after the items on your list (Q3) |

---

## 3. Your decisions (2026-10-24)

Recorded as D-29 to D-34 in `docs/decisions.md`.

| # | Decision |
|---|---|
| Q1 | **Michael is built inside Pioneer** as the commander. Your Grok bot Michael Scott stays a separate system; connecting the two is tested later (§3a) |
| Q2 | **Start with the 6 roles:** Claude, Developer, QA, Security, Documentation, Operations. The other M7 roles (Sales, Client Onboarding, Marketing & SEO, Client Success, Finance & Admin) are retired, not deleted, so their history stays. Grok bots are mapped to roles after the connection test |
| Q3 | Your list **adds to** the 4.0 draft. Chat panel, iPhone app (iPhone dictation for voice) and the Website Demo workflow stay in |
| Q4 | Agents run **inside a container only**, never directly on your Mac |
| Q5 | **No merge yet.** Milestone summary with test steps: `docs/os4/MILESTONE_REVIEW.md` |
| Q6 | Caps per month: **total $150** (aim $50–100), **Anthropic $75, OpenAI $40, all others combined $35**. At **80%** of any cap (total $120, Anthropic $60, OpenAI $32, others $28) agent work in that cap **stops** and you get an alert. You raise or reset a cap; agents can't |

Q6 needs one new database rule: today caps exist only per provider, so a combined "others" cap
and the overall total cap are added in phase C.

## 3a. Connecting Grok Michael Scott (proposed by Michael Scott, 2026-10-24)

Michael Scott's proposal:

1. **Pioneer → Grok:** a webhook routine on Michael Scott gives a private address. When Pioneer's
   Michael has a task, it sends a short note (client, task, blueprint ID) there. Michael Scott
   assigns it to the right Grok bot as he does today. The address lives only in `.env.local`.
2. **Grok → Pioneer, at first:** results are written to the **Agency Dashboard** Google Sheet,
   and Pioneer reads them from there.
3. **Later:** a small results endpoint in Pioneer, protected by a secret key.
4. **Test small first:** one fake task end to end ("draft a follow-up for test client") before
   any real client work.

This works well, and the sheet route avoids opening your Mac to the internet for the test. Four
conditions:

| Point | Why | Condition |
|---|---|---|
| "No new code needed" | Pioneer can't read Google Sheets today | Pioneer needs **read-only access to that one sheet** (a small part of phase F, pulled forward) |
| Who can write to the sheet | Every Grok bot, and anyone with edit access, can write any row | Pioneer sends each task with its **job ID and a one-time code**. A row without a matching pair is ignored. Results are stored as untrusted text: never treated as instructions, approvals or price changes |
| One permanent secret key for the later endpoint | All bots share one computer, so one leaked key works for every job, forever | **One key per job**, short-lived and single-use (as in `PLAN.md` §3.3) |
| What the note contains | It leaves Pioneer | IDs, task text and business details only. No contact details, credentials or invoice data |
| Two Michaels | Easy to mix up in logs | Labeled **Michael (Pioneer)** and **Michael Scott (Grok)** everywhere |

Placement: a new phase **X (Grok connection test)** after phase D. It needs your webhook address
in `.env.local`, the sheet shared read-only with Pioneer, and a made-up "Test Client (example)".
Grok (xAI) stays blocked in the database until then (D-24): this route doesn't use the xAI API.

---

## 4. Revised phases

Each phase gets its own branch, tests and evidence, and stops for your approval, as before.

| Phase | Covers features | Main work |
|---|---|---|
| **G: Groundwork** | 13 | M1–M7 merged to `main` (only after you approve, Q5); branch protection with required CI checks; remove stale Hermes text; fix the database test that depends on leftover data |
| **C: Commander + roster** | 1, 2, 3, 11, 12 | Michael (Pioneer) as commander; the 6 roles, other roles retired; **skills library** (versioned, attached to agents); worker runs jobs; costs recorded automatically per job and agent; total, per-provider and combined caps with the 80% stop and alert; per-agent activity view |
| **S: Safety layer** | 5, 6, 16 | Every job runs in a container (OrbStack), never on your Mac directly; command and network allowlists per skill; downloads blocked except approved package registries; secret scanning on every output; approvals tied to the exact payload; autonomy settings (start: everything sensitive needs approval) |
| **D: Delegation** | 10, 4 | Michael splits a request into steps and assigns agents, including Claude; jobs can wait on each other; routines can start agent work on a schedule |
| **X: Grok connection test** | 10 | §3a: one fake task, Pioneer → Michael Scott webhook → Agency Dashboard sheet → Pioneer. Then the Grok bots are mapped to the 6 roles |
| **Q: Quality gates** | 7, 8, 9, 13 | Agents work on branches and open pull requests only; CI must pass before you see a change; scheduled code audit (duplication, complexity, dependency health) and performance checks (slow pages, slow queries, memory) that produce Issues, not edits |
| **H: Dashboard** | 17, 18 | Dashboard tiles for agents, running jobs, AI approvals and spend; client workspace gains Documents and Agent work tabs |
| **F: Documents** | 14 | Google Drive, Sheets and Dropbox, read-only and limited to folders you choose; files linked to clients and projects |
| **I: Improvement** | 15 | Agents file improvement proposals (to skills, routines, code); you approve; changes then go through the normal branch → tests → approval path. No agent can edit its own instructions or permissions |
| **4.0 draft items (kept, Q3)** | — | Chat panel with plan cards (talk to Michael); iPhone home-screen app with dictation; Website Demo workflow; VPS when the Mac is no longer enough |

MVP = G + C + S + D: you give Michael a request, he plans it, assigns agents (including Claude),
work runs in a sandbox on your Mac, every step and cost is logged, and anything sensitive waits for
your approval.

---

## 5. Not decided here

- Exact Claude models per task, and the caps (Q6). Costs are not estimated with invented numbers.
- GitHub: a GitHub App vs fine-grained tokens. Decided at phase Q.
- Dropbox vs Drive as the main source of truth when both hold a file. Decided at phase F.
