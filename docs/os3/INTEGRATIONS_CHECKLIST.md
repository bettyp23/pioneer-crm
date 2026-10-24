# Integrations checklist

For: the owner. Tick items as you finish them. Details for each are in
[PIONEER_OS_SETUP_GUIDE.md](PIONEER_OS_SETUP_GUIDE.md).

**Bring back only what the "Bring back" column says.** Never send passwords, API keys, tokens
or webhook secrets in chat or email. They go straight into the place named in the setup guide.

## Before M8 (go live)

| ✓ | Item | Status | Bring back |
|---|---|---|---|
| ☐ | Review and approve merging branches M1 → M7 into `main` | Waiting on you | "approved" |
| ☐ | GitHub Pro + ruleset on `main` | Have GitHub; Pro not confirmed | Pro active: yes/no |
| ☐ | Supabase Pro organization + project in US East | Not started | Project ref, region |
| ☐ | Vercel Pro + spend limit + preview protection | Not started | Team name, production URL |
| ☐ | Domain chosen (D-13) | Open | Domain name, e.g. `os.example.com` |
| ☐ | Cloudflare DNS (optional) | Not started | Yes/no |
| ☐ | Sentry Developer (free) | Not started | Yes/no |
| ☐ | Decide point-in-time recovery for Supabase (paid add-on) | Open | Yes/no |

## Before M10–M11 (agents)

| ✓ | Item | Status | Bring back |
|---|---|---|---|
| ☐ | Confirm M7 roster names (rename any you like on the Agents tab) | Built | OK / changes |
| ☐ | OpenRouter account, 2FA, $10 credits | Not started | Yes/no |
| ☐ | OpenRouter keys `pioneer-dev` ($5/mo) and `pioneer-prod` (your cap) | Not started | Your monthly cap (proposed $50) |
| ☐ | OpenRouter guardrail: allowed providers + zero data retention | Not started | Providers you allow |
| ☐ | Hostinger KVM 2, Ubuntu 24.04, SSH key added, hPanel 2FA | Not confirmed | Plan, location, IP, "key added" |
| ☐ | Chat channel for Hermes (Telegram recommended, or none) | Open | Telegram / Slack / none |

## Before M12–M13 (sales and payments)

| ✓ | Item | Status | Bring back |
|---|---|---|---|
| ☐ | D-9: invoices issued by Stripe? | Open | Yes / other tool |
| ☐ | Stripe account verified, test mode only | Unknown | Verified: yes/no |
| ☐ | Restricted key + webhook endpoint (test) | Not started | Created: yes/no |
| ☐ | Google Workspace Business Starter on your domain | Unknown | Account type, sending address |
| ☐ | Google Cloud project, Internal consent screen, OAuth client | Not started | Created: yes/no |
| ☐ | Approved email templates (onboarding, reminders) | Open | Wording you approve |
| ☐ | Lead qualification rules (which leads are a fit) | Open | Your rules in plain words |
| ☐ | Standard packages and prices to show in proposals | Partly in catalog | Confirm the catalog |

## Before M14 (development pipeline)

| ✓ | Item | Status | Bring back |
|---|---|---|---|
| ☐ | OpenAI project `codex-ci` + budget + project key | Not started | Budget (proposed $30) |
| ☐ | Which client repositories agents may work on | Open | Repository names |
| ☐ | Fine-grained GitHub token for the worker | Not started | Created: yes/no (token goes to the VPS) |

## Before M15 (maintenance)

| ✓ | Item | Status | Bring back |
|---|---|---|---|
| ☐ | List of client sites to monitor | Open | URLs |
| ☐ | What "routine maintenance" an agent may do without asking | Open | Your list (see AUTONOMY_POLICY Level 2) |
| ☐ | Whether Pioneer OS may read a support inbox (restricted Gmail scope) | Open | Yes/no |

## Decisions waiting on you

| ID | Question | Recommendation |
|---|---|---|
| D-4 | Staging environment | Separate free Supabase project for previews |
| D-5 | Supabase plan and region | Pro, US East |
| D-9 | Invoice tool | Stripe |
| D-13 | Production domain | `os.<your-domain>` |
| D-23 | Adopt Hermes as the agent runtime | Yes (this plan) |
| D-24 | OpenRouter $50 cap replaces the xAI $50 cap | Yes |
| D-28 | Codex through the GitHub Action, $30/month cap | Yes |
