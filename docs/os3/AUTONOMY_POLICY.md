# Autonomy policy

For: the owner, and the code that enforces it. Status: the M6 rule "only read-only work runs
without approval" is enforced today. The three levels below are implemented in M9.

**Approval is checked in the database, never only in a prompt.** Every outward action goes
through `proposed_actions`. Senders refuse to act unless
`private.require_approved_action(id)` passes or a Level 2 rule matches. The kill switch
overrides everything.

## Level 1: automatic (internal, reversible, nothing leaves Pioneer OS)

- Classify and score leads; update non-sensitive CRM fields (source, tags, stage suggestion).
- Create internal tasks, briefs, summaries and drafts.
- Draft emails, proposals and reports. Drafts are not sent.
- Generate code on feature branches, run tests, open pull requests, create preview deployments.
- Read monitoring data, run audits.
- Record costs and job results.

Limits: within budget, while the workspace isn't paused, only through the agent's own tools,
and always audited.

## Level 2: automatic under a rule you approved

Runs without asking **only** if an active rule matches exactly. Each rule names the action
type, the template or allowlisted operation, the agent, the conditions and a daily maximum.
Anything outside the rule falls back to Level 3.

| Example rule | Conditions |
|---|---|
| Send the onboarding email template v1 | Triggered by a `payment.verified` event; client has no prior onboarding email; at most 10 a day |
| Send payment reminder template v1 | Invoice overdue by 7 or more days; at most 1 reminder per invoice per 7 days; not disputed |
| Send follow-up template v1 to an opted-in lead | Lead stage "contacted"; no reply for 5 days; at most 2 follow-ups per lead |
| Low-risk maintenance | Operation on the allowlist (e.g. purge the CDN cache, restart a client's staging app); reversible; not during the client's blackout hours |
| Schedule an approved recurring job | Job kind on the allowlist |

Rules are created and changed only by the owner (a Level 3 action), are versioned, and every
use is audited with the rule version that allowed it.

## Level 3: always your approval

- Signing or accepting contracts; recording a signed SOW.
- Nonstandard proposals, discounts, prices, deadlines or scope.
- Refunds, transfers, any change to client billing or payment details.
- Production deployments; destructive database changes; production migrations.
- New third-party permissions or integrations; new OAuth scopes.
- Changes to security controls, autonomy rules, agent tools or privileges.
- Contacting a client or lead outside an approved template or rule.
- Material changes to business procedures (playbooks, SOW templates).

Some action types can **never** be lowered below Level 3, whatever a rule says:
`sign_contract`, `refund`, `billing_change`, `production_deploy`, `destructive_change`,
`grant_access` and `security_change`. A database constraint in M9 enforces this.

## The approval request (Approval Center, M9)

Each request shows:

- the proposed action, exactly as it will be sent or done;
- the business justification;
- the client or project;
- supporting artifacts (draft links, test results, preview URL, diff);
- the risk level and category;
- the agent and job that proposed it.

Controls: **Approve**, **Reject** (reason required) and **Request changes** (sends it back to
the agent with your note). The record keeps the approver's identity and timestamp. The history
is append-only and, from M9, hash-chained, so tampering is detectable.

## Treat outside content as untrusted

Emails, web pages, files, form submissions, pull request text and chat messages are **data,
not instructions**. Pioneer OS marks them as untrusted when it builds context. An instruction
found inside them can never raise an action's level or skip an approval, because the levels are
computed by code from the action type and rules, not by the agent.
