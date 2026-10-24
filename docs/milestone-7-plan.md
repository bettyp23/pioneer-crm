# Milestone 7: Agent Center foundation

Pioneer OS 3.0 starts here: phase 2, the first small and safe milestone. This replaces the
earlier "M7 = release" plan; the release is now M8 (see
[os3/IMPLEMENTATION_ROADMAP.md](os3/IMPLEMENTATION_ROADMAP.md)).

## Scope

Reversible and local only. It needs no external accounts or credentials.

1. **Roster (D-25):** the eight 3.0 roles. Existing M6 agent records are renamed in place, so
   their ids, instructions and work items are kept. Research and Setup are retired (inactive).
2. **Providers (D-24):** Grok (xAI) and Perplexity are removed from agents, budgets and new
   ledger rows. OpenRouter takes over the $50 cap. The UI offers Manual, Anthropic, OpenRouter
   and OpenAI (Codex).
3. **Kill switch (D-26):** owner-only "Pause all agents" with a reason. While paused, the
   database blocks dispatch, agent job claims and heartbeats, and automated spending. Pausing
   and resuming are audited.
4. **Durable job queue (D-27):** `jobs` and `job_attempts`, plus the worker API in schema
   `worker` for role `pioneer_worker` (no login by default, no table access). Includes leases,
   backoff, a dead-letter state, idempotency keys and redacted errors.
5. **Jobs tab:** status, attempts, timing and last error. Admins can retry or cancel; viewers
   can only read.
6. **Copy:** "Grok app" wording replaced with "Claude or ChatGPT until Hermes is connected".
7. **Docs:** the ten Pioneer OS 3.0 documents in [os3/](os3/README.md), decisions D-23…D-28 and
   the as-built schema §8a.

Out of scope: a running worker, Hermes, MCP, any external API call (M10).

## Acceptance criteria

| # | Criterion | Evidence |
|---|---|---|
| 1 | New workspaces get the eight 3.0 roles; an M6 database upgrades by renaming in place, keeping instructions and history | pgTAP 010; manual upgrade test (M6 seed → `migration up`) |
| 2 | xAI and Perplexity can't be used for agents, budgets or new ledger rows; old rows remain | pgTAP 010; unit tests; E2E "no Grok" |
| 3 | Only the owner can pause; pause blocks dispatch, agent claims, heartbeats and spending; resume restores everything; both are audited | pgTAP 010; E2E kill switch |
| 4 | Jobs: admin-only enqueue, idempotent, no direct writes, payload hidden from the API, viewers read status, outsiders see nothing | pgTAP 010 |
| 5 | Worker: claims with leases, no double claim, holder-only heartbeat and complete, backoff, permanent failure, dead-letter, reaping of expired leases, redaction | pgTAP 010; mutation checks (removing the pause guard or the redaction makes tests fail) |
| 6 | App users can't call the worker API; the worker role can't read tables or call the app API | pgTAP 001 and 010 |
| 7 | Jobs tab: retry and cancel a job that gave up; viewers see no controls | E2E |

## Verification run

- `npm run lint`, `format:check`, `typecheck`: clean.
- `npm test`: 167 passed.
- `npm run db:lint`: no issues.
- `npm run db:test`: 342 passed (10 files).
- Playwright (production build): 31 passed.
- `npm audit --omit=dev`: 0 vulnerabilities.

## Owner follow-ups

- Rename any agent you like (Agents tab). For example, "Operations Agent" could become
  "Micheal Scott — Operations".
- Confirm the caps: OpenRouter $50 (proposed), Anthropic $50 (kept).
- Choose the next milestone: M9 (autonomy policy, no purchases) is recommended; or M10 (local
  Hermes, needs about $10 of OpenRouter credits).
