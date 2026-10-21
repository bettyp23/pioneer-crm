# Milestone 6 — AI Command Center and Approval Center

Scope: FR-AGT-1…5 ([requirements.md](requirements.md) §2.6), re-scoped after the vision review
([Vision vs. Build Review](https://claude.ai/artifact/PUjATJKyWADpxWdaG8im6i)): D-10, D-19…D-22.
Status: **Implemented — awaiting owner review** · 2026-10-21 · Branch `feat/m6-ai-command-center` (stacked on
`feat/m5-operations`).

## What it does

- **Agents:** the eight roles from the vision (Michael Scott — Orchestrator, Client Desk,
  Research, Developer, Setup, Reviewer/QA, Maintenance, Operations/Finance) as records: role,
  provider, saved instructions (pasted from the Grok app), allowed work types. Agents have no
  login, no database access and no keys (FR-AGT-1).
- **Work items:** a human picks an agent, a client/project and what context to include. The
  server builds a frozen **context snapshot** (business information by default; contact
  details, notes, invoice and SOW details only when ticked) and scans it for sensitive data
  (emails, phones, tokens in URLs, key-like strings, card-like numbers, health terms). Flagged
  items need an override reason, audited (FR-AGT-2).
- **Hand-off:** "Copy prompt" (agent instructions + task + context) to paste into the Grok app
  or Claude; dispatch is a recorded human action (FR-AGT-3).
- **Review:** paste the reply back; an owner/admin accepts or rejects it. Accepting changes no
  records (FR-AGT-4).
- **Proposed actions (Approval Center):** anything to be sent, deployed, priced, signed or
  published is a proposed action that waits for a decision, enforced in the database (D-20).
  Pricing and contracts: owner only. In M6 the action is carried out by hand and then marked
  executed — only an approved action can be.
- **Budgets and costs:** monthly caps per provider ($50 Anthropic, $50 xAI — D-21), a cost
  ledger, spend vs. cap, and a database check later connectors must pass before any call.
- Everything is audited (FR-AGT-5).

## Screens (navigation unchanged — D-22)

"Work queue" in the sidebar opens the AI Command Center: **Queue · Agents · Actions · Usage**.
Pending AI actions also appear on the existing **Approvals** page and the dashboard.

## Evidence (2026-10-21)

| Check | Result |
|---|---|
| pgTAP | 290 assertions pass (40 new): role seeding, $50 caps, draft → ready needs snapshot, flags need a reason, frozen after ready, member can't dispatch/approve, agent work-type rules, attributed dispatch/review, 4 audited transitions, accepting changes no records, action approval roles (pricing owner-only), nothing executes before approval, decisions final, append-only ledger, budget check, outsiders see nothing. Mutation check: disabling the approval gate fails the test. |
| Vitest | 151 tests pass (sensitivity scanner incl. masking and Luhn, prompt builder, micro-dollar money, schemas) |
| Playwright | paste agent instructions → work item with opt-in contacts → flagged (email masked) → reason required → ready → sent → output → accepted → propose email → approve on Approvals page → mark done → audit; business-only context unflagged; usage cap $50 + recorded cost; viewer read-only |
| Browser QA | Queue, Agents, Actions, Usage, work item, agent pages: no console errors |

Bug found by the end-to-end test and fixed: creating a draft with its context snapshot was
refused because the snapshot columns were only granted for update; a database test now covers it.

## Known limitations (M6)

- Hand-off is manual (copy prompt / paste reply); API connectors and the worker come later.
- Costs are recorded by hand until connectors record them.
- The scanner is a safety net with false positives (e.g. "patient" in a dental lead title); overrides are audited.
