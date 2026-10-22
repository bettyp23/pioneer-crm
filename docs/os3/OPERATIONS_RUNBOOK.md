# Operations runbook

For: the owner, and whoever operates Pioneer OS. Sections marked (M11) or later describe
systems that don't exist yet.

## Daily (2 minutes)

1. **Approvals:** open the Approval Center and decide what is waiting.
2. **AI Command Center → Jobs:** anything "Gave up" needs a look. Read the error, then
   **Retry** or **Cancel**.
3. **Usage:** budget bars under 90%.
4. (M15) **Incidents:** none open, or each has an owner.

## Emergency: stop all agents (kill switch)

When to use it: an agent is doing something unexpected, costs jump, or you suspect a leak.

1. Pioneer OS → AI Command Center → **Pause all agents** and give a reason. Owner only, and
   two-factor is required.
2. Effect, immediately and enforced in the database:
   - nothing can be sent to an agent;
   - the worker stops claiming agent jobs;
   - running agent jobs are told to stop at their next heartbeat (within about a minute);
   - automated AI spending is refused.

   Deterministic jobs (payments, reminders already approved) keep running.
3. If the VPS itself is suspect, also run `docker compose stop hermes worker` on the VPS (M11),
   or power it off in hPanel.
4. If a key may have leaked: rotate it (below).
5. Investigate in Settings → Audit log (`ai.paused`, `job.*`, `action.*`) and the Jobs tab.
6. **Resume agents** when it is safe. The resume is audited too.

To stop a single agent, set it inactive on its Agents page.

## Jobs that gave up

| Error looks like | Likely cause | Do |
|---|---|---|
| `Timed out: the worker stopped reporting progress` | Worker restarted or the VPS is down | Check the worker heartbeat; Retry |
| HTTP 402/403 from the model provider | OpenRouter limit reached | Raise the cap deliberately, or wait for the monthly reset |
| HTTP 401 | Expired or rotated token | Rotate or update the secret on the VPS; Retry |
| 5xx three or more times | Provider outage | Retry later |
| Validation error (permanent "Failed") | Bad input data | Fix the record; Retry |

A retry gives the job 3 more attempts, up to 20 in total.

## Rotate a secret

1. Create the new value at the provider. Don't revoke the old one yet.
2. Put the new value where the setup guide says (Vercel, the VPS secrets file or GitHub secrets).
3. Redeploy or restart: Vercel redeploy, or `docker compose up -d <service>` on the VPS.
4. Verify (each setup guide entry has a "Verify" step).
5. Revoke the old value at the provider.
6. MCP agent tokens: Agents → agent → Rotate token (M10). The old token stops working at once.

## Backups and restore

- **Database:** Supabase daily backups (Pro), plus point-in-time recovery if purchased.
  Quarterly restore test into a scratch project:
  - row counts match;
  - sign-in works;
  - `npm run db:test` passes against it.
- **VPS (M11):** nightly encrypted archive of `/opt/pioneer` (Hermes data and configs), copied
  off-server. Restore = new VPS + runbook §VPS + unpack the archive.
- **Code:** GitHub.

## VPS setup (M11), for the operator

1. Ubuntu 24.04. Create user `pioneer` and copy your SSH key. In `sshd_config`: `PasswordAuthentication no`, `PermitRootLogin no`, `AllowUsers pioneer`.
2. `apt install unattended-upgrades fail2ban ufw`. UFW: `default deny incoming`; `allow from <your IP ranges> to any port 22`.
3. Install Docker Engine from Docker's apt repository, and the Compose plugin.
4. `/opt/pioneer/` holds `compose.yaml` (from this repository, `deploy/vps/`, added in M10) and `secrets/*.env` (mode 600, owned by `pioneer`).
5. Services:
   - `hermes`: pinned image tag, `gateway run`, no host ports, dashboard on `127.0.0.1:9119`;
   - `worker`;
   - `pioneer-mcp` (internal network only);
   - `uptime-kuma` (on `127.0.0.1:3001`).
6. Enable the database login: in the Supabase SQL editor, run `alter role pioneer_worker login password '<generated>';` and the same for `pioneer_mcp`. Put the password only in the VPS secrets file.
7. Verify:
   - `docker compose ps` shows everything healthy;
   - the worker heartbeat is green in Pioneer OS;
   - a synthetic `agent.run` job succeeds;
   - from outside, `nmap` shows only port 22.
8. Weekly: `docker system prune -f --filter until=168h`. Upgrades are deliberate: bump the image tag in a pull request, test locally, then deploy.

## Access to the Hermes dashboard (M11)

`ssh -L 9119:127.0.0.1:9119 pioneer@<vps>`, then open `http://localhost:9119`. Never publish
it to the internet.

## Monthly

- Review the agent performance report (W12) and approve or reject improvement proposals.
- Review agent memory for personal data.
- Check renewals: VPS term, domain, Workspace seats.
- Check that the costs match your caps.

## Quarterly

- Restore test.
- Rotate the 90-day tokens.
- Review OAuth grants (Google, GitHub) and remove unused ones.
