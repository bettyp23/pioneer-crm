# Workflow catalog

Status: design. Each workflow is built in the milestone shown, on the job queue built in M7.

## Conventions that apply to every workflow

- **Trigger → job.** Every trigger (webhook, cron, UI action, Hermes request) creates a row in
  `jobs` with an idempotency key derived from the business event (e.g. `stripe:evt_123`), so a
  repeated event cannot start the workflow twice.
- **State lives in a `workflow_runs` row** (M9), with an explicit state machine. Steps are jobs
  linked to the run. Agent memory and chat history are never the state.
- **Retries:** jobs retry with exponential backoff (30 s, 1 min, 2 min … up to 1 h), 5 attempts
  by default. Retries go to "gave up" when exhausted, then the owner is notified.
- **Timeouts:** each job has a lease (`timeout_seconds`, default 15 min for agent runs and 2 min
  for deterministic steps). A lost lease returns the job to the queue.
- **Outward actions** carry the proposed action id as their idempotency key.
- **Audit:** `job.*`, `workflow.*` and `action.*` events, plus row changes of affected records.
- **Approvals:** by level, per [AUTONOMY_POLICY.md](AUTONOMY_POLICY.md). "L3" below means the
  owner must approve in the Approval Center.
- **Untrusted input:** payloads from clients, emails, websites and pull requests are data, never
  instructions.

---

## W1. Website purchase → verified payment → CRM record → onboarding (M12–M13)

| Field | Design |
|---|---|
| Trigger | Stripe `checkout.session.completed` webhook |
| Inputs | Stripe event id, session id, customer email, Price id → package, client reference (if from a proposal) |
| Systems | Stripe (read), Pioneer OS DB, Gmail (send template), Drive (create folder) |
| Agent | Client Onboarding (drafting only); verification is deterministic |
| Steps | 1. Webhook: verify signature, insert `stripe_events` once, enqueue `stripe.process_event`. 2. Worker: **re-fetch the session from Stripe** and confirm `payment_status = paid` and that the amount equals the package price. 3. Upsert client and contact, create a `payments` row and the project from the package's blueprint (`generate_project`, idempotent). 4. Create the Drive folder (`drive.file`). 5. Enqueue `agent.run` for the onboarding brief and questionnaire. 6. Send onboarding email template v1 (L2 rule) |
| States | received → verified → client_ready → project_created → onboarding_sent → done · or amount_mismatch / failed |
| Retry and timeout | Stripe re-delivers for days; our job retries 5 times; Stripe fetch timeout 10 s |
| Idempotency | `stripe_events.id` unique; project keyed by the payment id; email keyed by the action id |
| Approvals | None if amounts match and the template rule is active; **amount mismatch → L3** |
| Failure handling | Gave-up job notifies you; payment stays recorded; no email sent |
| Audit | event received, payment verified, client/project created, email sent (rule version) |
| Done when | Payment verified, project exists, onboarding email sent, brief job queued |

## W2. Completed intake → project brief → scope validation → development tasks (M13)

| Field | Design |
|---|---|
| Trigger | All required `client_input_requests` for a project become "received" |
| Inputs | Intake answers, files (Drive links), package scope, SOW |
| Systems | DB, Drive (read selected files), Hermes |
| Agent | Client Onboarding (brief), Operations (task routing) |
| Steps | 1. Enqueue `agent.run` brief. 2. Agent writes the brief and flags missing information. 3. Deterministic **scope check**: brief items mapped to package/SOW items; anything extra is flagged. 4. If there is no scope drift, generate development tasks from the blueprint. 5. If there is scope drift, propose a change order (L3) |
| States | inputs_complete → brief_drafted → scope_checked → tasks_created · or scope_change_pending |
| Retry and timeout | Agent run 15 min, 3 attempts |
| Idempotency | Brief keyed by the project id and inputs version |
| Approvals | Brief: none (internal). Scope change: L3 |
| Failure handling | Missing info → task "ask client" (draft only) |
| Audit | brief created, scope result, tasks generated |
| Done when | Tasks exist and the scope check is clean or approved |

## W3. Development task → Codex → pull request → CI → QA → preview (M14)

| Field | Design |
|---|---|
| Trigger | Development task moves to "ready" with acceptance criteria |
| Inputs | Repo, base branch, task text, acceptance criteria |
| Systems | GitHub (Actions dispatch, pull requests), Codex GitHub Action, Vercel previews, CI |
| Agent | Development (prepares the Codex prompt), QA & Security (reviews) |
| Steps | 1. Development agent drafts the Codex instructions. 2. Worker dispatches the `codex.yml` workflow on branch `agent/<task-id>`. 3. The action commits and opens a pull request. 4. GitHub webhooks report CI and the preview URL → `ci_runs`, `preview_deployments`. 5. QA agent reviews the results against acceptance criteria and records `qa_results`, or files a defect and loops back to step 1 (max 3 loops) |
| States | queued → coding → pr_open → ci_running → qa_review → ready_for_internal_review · or blocked |
| Retry and timeout | Workflow dispatch retries 3 times; Codex run times out at 30 min; CI time per repo |
| Idempotency | Branch name derived from the task id; one open pull request per task |
| Approvals | None (feature branches and previews are L1). Merge is not part of this workflow |
| Failure handling | 3 failed loops → escalate to you with the logs |
| Audit | dispatch, pull request link, CI result, QA verdict |
| Done when | Pull request is green, QA passed, preview URL recorded |

## W4. Preview approved internally → client review → feedback → revisions (M14)

| Field | Design |
|---|---|
| Trigger | You mark the preview "ready for client" (L3, because it contacts the client) |
| Inputs | Preview URL (protected link or password), change summary |
| Systems | Gmail (send), DB |
| Agent | Client Success (drafts the message, organises feedback) |
| Steps | 1. Agent drafts the review email. 2. You approve; it is sent. 3. Client replies (logged manually, or via inbox intake after M15) → `revision_requests`. 4. Agent classifies each as in scope or a change order. 5. In-scope items → new development tasks (W3). Change orders → L3 |
| States | awaiting_client → feedback_received → revisions_in_progress → client_accepted |
| Retry and timeout | Reminder draft after 5 days without a reply |
| Idempotency | One review request per preview version |
| Approvals | Sending: L3 (or L2 once a template is approved). Change orders: L3 |
| Failure handling | No reply after 2 reminders → task for you |
| Audit | sent, feedback items, classification |
| Done when | Client acceptance is recorded with evidence (e.g. an email saved in Drive) |

## W5. Client acceptance → production deployment approval → launch (M14)

| Field | Design |
|---|---|
| Trigger | Client acceptance recorded |
| Inputs | Pull request, CI status, QA results, rollback plan |
| Systems | GitHub (merge), Vercel production, DNS (if a new site) |
| Agent | QA & Security (final checklist), Development (launch checklist) |
| Steps | 1. QA re-runs checks on the final commit. 2. A `production_deploy` action is proposed with evidence. 3. **You approve.** 4. The merge happens through GitHub's protected-branch rules, with you as the required reviewer, and Vercel deploys. 5. Smoke checks and uptime monitor created. 6. Launch email drafted |
| States | ready_for_launch → approved → deployed → verified · or rolled_back |
| Retry and timeout | Smoke checks retried 3 times; failure → rollback proposal (L3) |
| Idempotency | One deployment record per commit SHA |
| Approvals | **L3**, always |
| Failure handling | Failed smoke checks → incident (W9) and rollback proposal |
| Audit | approval, merge SHA, deployment id, verification |
| Done when | Production verified and monitoring active |

## W6. Website launch → maintenance proposal → optional subscription (M12, M15)

| Field | Design |
|---|---|
| Trigger | W5 reaches "verified" (scheduled 3 days later) |
| Inputs | Site, package, standard maintenance plans from the catalog |
| Systems | DB, Gmail, Stripe (subscription Checkout link) |
| Agent | Sales |
| Steps | 1. Agent drafts a maintenance proposal from **standard plans only**. 2. Send: L2 if template-based, L3 if anything is custom. 3. Client subscribes through Stripe Checkout → W1-style verification creates a `maintenance_plans` row |
| States | proposal_drafted → sent → subscribed / declined / expired |
| Retry and timeout | One follow-up after 7 days |
| Idempotency | One proposal per launch |
| Approvals | Custom pricing: L3 |
| Failure handling | Declined → reminder task in 90 days |
| Audit | proposal, send, subscription event |
| Done when | Subscription active or declined |

## W7. New lead → classification → follow-up → proposal → conversion (M13)

| Field | Design |
|---|---|
| Trigger | Inquiry form submission (Pioneer OS public form endpoint, rate limited, captcha) or a manually entered lead |
| Inputs | Form fields, source, consent flag |
| Systems | DB, Gmail, Calendar (meeting slots), Stripe (Checkout for standard packages) |
| Agent | Sales |
| Steps | 1. Deterministic spam and duplicate checks. 2. Agent classifies against your written rules and suggests a package. 3. Follow-up email draft (L2 template, or L3). 4. Meeting request with a Calendar link. 5. Proposal draft: standard package → L2 Checkout link; anything custom → L3 |
| States | new → qualified / disqualified → contacted → meeting → proposal_sent → won / lost |
| Retry and timeout | Follow-ups at days 2 and 5, then stop |
| Idempotency | Form submission id; one active sequence per lead |
| Approvals | Nonstandard proposals: L3 |
| Failure handling | Unclassifiable → owner task |
| Audit | classification, messages, proposal, outcome |
| Done when | Won (payment → W1) or lost with a reason |

## W8. Support ticket → triage → authorized resolution → report (M15)

| Field | Design |
|---|---|
| Trigger | Support email (if inbox reading is approved), form, or manual entry |
| Inputs | Ticket text, client, site, maintenance plan |
| Systems | DB, monitoring, allowlisted maintenance operations |
| Agent | Client Success & Maintenance |
| Steps | 1. Classify severity and whether it is in plan scope. 2. In scope and allowlisted → L2 operation. 3. Otherwise → proposal (L3) or a task. 4. Draft the resolution report |
| States | open → triaged → in_progress → resolved → reported |
| Retry and timeout | SLA timers per plan; breach → escalation |
| Idempotency | One ticket per message id |
| Approvals | Non-allowlisted fixes: L3 |
| Failure handling | Emergency severity → immediate notification to you |
| Audit | classification, actions, report |
| Done when | Resolved and the client has been notified |

## W9. Monitoring alert → incident → diagnosis → safe remediation plan (M15)

| Field | Design |
|---|---|
| Trigger | Uptime Kuma push, Sentry alert, SSL/domain expiry check, failed smoke check |
| Inputs | Monitor id, error details |
| Systems | Uptime Kuma, Sentry, DB |
| Agent | Client Success (diagnosis), QA & Security (if security related) |
| Steps | 1. Deduplicate alerts into one incident (coalesce by monitor and 30-minute window). 2. Agent diagnoses from the read-only data. 3. Remediation plan: allowlisted → L2, else L3. 4. Draft a client notice (L3) |
| States | open → diagnosing → plan_proposed → remediating → resolved → postmortem |
| Retry and timeout | Diagnosis 10 min; alerts re-checked every 5 min |
| Idempotency | Incident key = monitor + window |
| Approvals | Per plan step |
| Failure handling | Diagnosis fails → notify you with the raw alert |
| Audit | full incident timeline |
| Done when | Monitor green for 30 min and the postmortem is written |

## W10. Invoice due → status check → approved reminder → reconciliation (M12)

| Field | Design |
|---|---|
| Trigger | Daily cron (`invoice.daily_check`, keyed by date) |
| Inputs | Invoices with due date and status; Stripe invoice status |
| Systems | Stripe (read), Gmail |
| Agent | Finance & Admin (drafts); the status logic is deterministic |
| Steps | 1. Sync Stripe status. 2. Overdue by the rule's days, not disputed, no reminder in 7 days → reminder template (L2) or draft (L3). 3. `invoice.paid` webhook → mark paid and reconcile the amount |
| States | open → due → overdue → reminded → paid / written_off (L3) |
| Retry and timeout | Stripe sync retried 5 times |
| Idempotency | Reminder keyed by invoice and week |
| Approvals | Write-off, refunds, any billing change: L3 |
| Failure handling | Amount mismatch → task for you |
| Audit | status changes, reminders |
| Done when | Paid and reconciled, or written off with approval |

## W11. Weekly operations summary (M9 data, M16 polish)

| Field | Design |
|---|---|
| Trigger | Cron, Monday 8:00 in the workspace timezone (`report.weekly_summary`, keyed by ISO week) |
| Inputs | Pipeline, projects, overdue tasks, approvals waiting, incidents, AI spend, gave-up jobs |
| Systems | DB, optional Telegram delivery |
| Agent | Operations |
| Steps | Deterministic numbers first, then a short agent-written summary of priorities |
| Approvals | None (internal) |
| Done when | Summary stored and delivered to you |

## W12. Monthly agent performance review → improvement proposals (M16)

| Field | Design |
|---|---|
| Trigger | Cron, first of the month |
| Inputs | Job outcomes, retries, review verdicts (accepted/rejected), cost per role and model, defects found later |
| Agent | Operations (analysis); proposals go through evaluation |
| Steps | 1. Compute metrics. 2. Agent proposes skill, prompt, template or routing changes. 3. Each proposal runs against the evaluation set and is compared with the baseline. 4. Results go into an improvement proposal |
| Approvals | Promotion is **L3**. Security, financial, customer-commitment, privilege and deployment changes can never be auto-promoted |
| Done when | Report delivered; approved changes merged in GitHub with a version tag |
