# Milestones M1–M7: summary and how to test them

Status: **For owner review before merge** · 2026-10-24

All seven milestones are on stacked branches (`feat/m1-foundation` → … →
`feat/m7-agent-center-foundation`). `main` still holds only the initial commit. Nothing is merged
until you approve.

## Before you start

1. Start the database and the app (if not running): `npm run db:start`, then `npm run dev`.
2. For a clean start, run `npm run db:reset`. It wipes the local database and reloads the made-up
   sample data. Nothing real is stored there.
3. Open http://localhost:3000/login and sign in as `owner@example.test` / `local-dev-password`.
   Get the 6-digit code with:
   ```sh
   node -e "import('otpauth').then(({TOTP})=>console.log(new TOTP({secret:'PIONEERLOCALDEVTOTPSECRET234567A'}).generate()))"
   ```
4. To check the read-only view, sign out and sign in as `viewer@example.test` (same password and
   code generator).

## Automated checks, rerun 2026-10-24 on `docs/os4-plan` (contains M1–M7)

| Check | Result |
|---|---|
| Lint, typecheck | Pass |
| Unit tests | 167 / 167 pass |
| Database tests | 342 / 342 pass on a freshly reset database |
| End-to-end (browser) tests | 31 / 31 pass |

**Problem found:** one database test ("each lead stage change is audited") fails if the
browser tests ran on the same database first. It counts every stage change in the database, not
only its own. GitHub CI is not affected, because it always starts from an empty database. To be
fixed in the first new phase (G), so it does not change the branches under review.

---

## M1: Foundation (sign-in and security)

**Adds:** email + password + authenticator code (no public sign-up), roles (owner, admin,
member, viewer), workspace settings, members list, audit log, security headers.

**Test it:**
1. Sign in as owner. You land on the Dashboard after the code step.
2. Sign out, then open http://localhost:3000/dashboard directly. You are sent back to the login page.
3. Sign in as `enroll@example.test`. You are asked to set up an authenticator (QR code) first.
4. Sign in as `outsider@example.test`. You see "No workspace access".
5. As owner: **Settings → Workspace**, rename the workspace, then check **Settings → Audit log**
   shows the change.
6. As viewer: **Settings → Audit log** is not available.

## M2: Clients and pipeline

**Adds:** clients, contacts, leads with pipeline stages, activities, follow-ups.

**Test it:**
1. **Clients → New client**, then add a contact on the client page.
2. Add a lead for that client and move it to another stage on **Pipeline**.
3. Try to mark a lead *lost* without a reason. It is refused.
4. Log an activity and a follow-up on the client page. Mark the follow-up done, then check the
   **Dashboard** follow-ups tile.
5. As viewer: you can read everything, but there are no edit buttons.

## M3: Services, packages and blueprints

**Adds:** service catalog, packages, and versioned project blueprints (tasks, prerequisites,
inputs the client must provide). A published version can't be edited.

**Test it:**
1. **Services & packages**: add a service, then a package that contains it.
2. **Blueprints → New**: add tasks, make one task depend on another, add a client input.
3. Publish. The editor disappears and a fingerprint (hash) is shown.
4. Create a new draft from it. The content is copied, and the published version stays unchanged.
5. Make two tasks depend on each other (a loop). Publishing is refused.

## M4: Projects and delivery

**Adds:** statements of work (SOW), projects generated from a blueprint, tasks with blockers,
client inputs, project approvals.

**Test it:**
1. On a client page, **SOWs** tab: add a SOW and mark it signed.
2. **Projects → Generate project**: pick the client, the signed SOW and a published blueprint.
3. On the project: finish the first task. A task that needs approval can't be finished until
   the approval is recorded on **Approvals**. A client approval needs an evidence link.
4. A task waiting on a client input stays blocked until the input is accepted.
5. Double-clicking Generate creates only one project.

## M5: Operations

**Adds:** routines (recurring checklists), diagnostics, issues, invoice records (no payments),
reports.

**Test it:**
1. **Routines → New routine** due today. Mark it Done. Its compliance shows 100%.
2. **Diagnostics → New**: a score above 100 is refused. Create an issue from the diagnostic.
3. **Issues**: resolving an issue requires a resolution note.
4. **Invoices → New**: recording the same invoice number twice is refused. Mark one paid.
5. **Reports**: all six reports load.

## M6: AI Command Center and Approval Center

**Adds:** agent records with saved instructions, a work queue where you hand context to an agent
by copy and paste, a sensitive-data check on that context, proposed actions that wait for your
approval, and per-provider cost caps with a ledger typed in by hand.

**Test it:**
1. **Work queue → New work item**: pick an agent and a client and tick "Contacts with emails and phones". The
   email address is flagged and you must give a reason to continue.
2. Use **Copy prompt**, mark it sent, paste any reply back, and accept it.
3. From the item, propose "send an email". It appears under **Actions** and on **Approvals**.
   It can be marked done only after you approve it.
4. **Usage**: record a cost. The spend bar moves.

## M7: Agent Center foundation

**Adds:** "Pause all agents" kill switch (owner only), a durable job queue with retries (nothing
runs jobs yet), a **Jobs** tab, and a renamed roster of 8 roles. Grok (xAI) is blocked in the
database.

**Test it:**
1. **Work queue → Pause all agents**, with a reason. Sending a work item is now refused. Resume
   it. Both steps appear in the audit log.
2. **Jobs** tab: the sample job that gave up has **Retry**. Click it and the job is queued again.
3. As viewer: the Jobs tab shows no buttons.

**Note before approving M7:** parts of it are already reversed by your 2026-10-24 decisions:
the 8-role roster, the "Hermes" wording and the Grok block. They are corrected in a new database
migration in the next phase, not by editing M7. The kill switch and job queue in M7 are what the
new work builds on.

---

## Merge options (your call)

| Option | What happens |
|---|---|
| **A (recommended): merge M1–M7 in order**, one pull request each | `main` gets everything; GitHub runs the checks on each pull request; the next phase fixes M7's outdated parts going forward |
| B: merge M1–M6 only | M7 stays open. The next phase then has to branch from M7 anyway, because it builds on the job queue |
