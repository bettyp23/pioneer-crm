# Security and privacy

Extends [../security.md](../security.md), which covers the web app as built: authentication,
two-factor, RLS, headers, supply chain. This page adds what agents, the VPS and integrations
change.

## 1. Assets

Client business data and contacts; payment status (never card data, which stays at Stripe);
your accounts (Stripe, Google, GitHub, Supabase, Vercel, OpenRouter, Hostinger); client
websites and repositories; the audit log; agent memory.

## 2. Main threats and controls

| Threat | Controls |
|---|---|
| **Prompt injection** via email, web page, file or pull request | Outside content is labelled untrusted in context; agents only *propose* outward actions; levels are computed by code; tools are scoped per role; Hermes webhook routes are unused |
| **Agent exceeds its role** | Per-agent MCP token → tool allowlist (`agent_tools`) → database checks; work types enforced; kill switch; per-agent inactive flag |
| **Stolen VPS** | No inbound ports except key-only SSH; containers run non-root; `pioneer_worker`/`pioneer_mcp` roles can call only their functions; no Stripe, Google or Supabase admin secrets on the VPS; tokens are revocable from Pioneer OS |
| **Stolen web session** | 2FA on every sign-in; short sessions; Level 3 actions also need 2FA (aal2) at decision time |
| **Leaked secret in logs or prompts** | Context scanner flags keys, emails, phones, cards and SSNs; `redact_secrets` on stored errors; Sentry scrubbing; secrets never placed in prompts or job payloads |
| **Forged webhook** | Signature verification (Stripe, GitHub), timestamp tolerance, event id stored once, rate limit |
| **Replay or double execution** | Idempotency keys on jobs, events and outward actions |
| **Runaway cost** | OpenRouter per-key limit, OpenAI project budget, `ai_budget_allows`, Vercel spend limit, Supabase spend cap, kill switch |
| **Supply chain** (npm, Docker images, Hermes skills) | Pinned versions, `npm audit` in CI, pinned Hermes image tag, no community skills installed without review, Dependabot |
| **Data loss** | Supabase daily backups (and point-in-time recovery if chosen); encrypted off-server VPS backups; restore test each quarter |

## 3. Least privilege per credential

| Credential | Lives in | Scope |
|---|---|---|
| Supabase publishable key | Vercel | Public by design; RLS decides |
| `pioneer_worker` DB login | VPS secrets | Execute on 5 `worker.*` functions |
| `pioneer_mcp` DB login (M10) | VPS secrets | Execute on `mcp.*` functions |
| `pioneer_ingest` DB login (M12) | Vercel | Execute on `ingest.record_event` |
| Hermes `API_SERVER_KEY` | VPS secrets | Hermes API on the internal Docker network |
| MCP agent tokens | Hermes profile `.env` | One agent's tools; hashed in DB; 90-day expiry |
| OpenRouter key | Hermes `.env` | Models only; monthly limit; provider allowlist; ZDR |
| GitHub fine-grained token | VPS secrets | Actions write + read on chosen repos; 90-day expiry |
| `OPENAI_API_KEY` | GitHub Actions secrets | Codex in CI; project budget |
| Stripe restricted key | Vercel | Checkout, customers, invoices, subscriptions; **no refunds, payouts or transfers** |
| Stripe and GitHub webhook secrets | Vercel | Verification only |
| Google OAuth client and refresh token | Vercel + encrypted DB column | `gmail.send`, `drive.file`, `calendar.events` |

Rotation: every 90 days or immediately after any suspected exposure
([OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) §Rotate).

## 4. Data rules for AI (unchanged from D-22, extended)

- Business information may go to models by default.
- Contact details, notes, SOW details and invoice data go **only when the job needs them**.
  They are flagged and the reason is recorded.
- **Never:** health data, payment card data, government IDs, passwords or keys.
- Models are reached only through providers on the OpenRouter allowlist, with zero data
  retention required.
- Agent memory may hold procedures and lessons. It may not hold client personal data. A
  monthly review purges anything that violates this.
- Client data is never used to evaluate other clients' work. Evaluation sets are synthetic or
  anonymised (M16).

## 5. VPS hardening baseline (M11)

Ubuntu 24.04 LTS:

- `unattended-upgrades` for security updates.
- UFW: deny all incoming except SSH from your IP ranges.
- SSH: keys only, no root login, `AllowUsers pioneer`.
- fail2ban.
- Docker rootless or the `pioneer` user in the `docker` group, with every container running non-root.
- Hermes dashboard bound to `127.0.0.1` and reached by SSH tunnel; Hermes API not published to the host.
- `security.allow_private_urls: false`.
- Log rotation: 14 days for container logs, 90 days for job and audit data, which is in the database.
- Encrypted nightly backups of `/opt/pioneer` (Hermes data, configs) to off-server storage.
- Resource alerts for disk over 80% and memory pressure.

## 6. Web and API hardening additions

- Public endpoints (intake form, webhooks) have per-IP rate limits, size limits and a captcha on forms.
- CSP stays nonce-based.
- Protected Vercel previews.
- Production environment variables are separated from preview ones; test keys are refused in
  production, and live keys outside it.

## 7. Privacy

- Pioneer OS is private and single-operator. Clients interact only through email, Stripe
  Checkout and intake forms.
- Retention:
  - leads that never convert: anonymised after 24 months;
  - audit log: kept;
  - job payloads: cleared 90 days after completion (results kept as summaries).
- A client asking for their data to be deleted triggers an owner task. Audit references are
  kept, and personal fields are anonymised.
