# VPS runbook (os.pioneerdigitalai.com)

Hostinger VPS `srv2185949` (2.25.104.128), Ubuntu 24.04. Pioneer OS runs here in Docker behind
Traefik. Root SSH with keys only; secrets live in files on the server, typed by the owner, never
in Git, chat or logs.

## Layout (verified 2026-11-23)

| Compose project | Path | What it is | Entry point |
|---|---|---|---|
| `traefik` | `/docker/traefik` | Reverse proxy, Let's Encrypt, HTTP→HTTPS redirect. `network_mode: host`, so it reaches containers on their Docker bridge IPs; containers need **no published ports**. Dashboard off. | `:80`, `:443` |
| `pioneer-crm` | `/docker/pioneer-crm` | The app. On each start: clone or fast-forward `main` with the read-only deploy key, `npm ci`, build, start. | `https://os.pioneerdigitalai.com/login` |
| `hermes-agent-wp0p` | `/docker/hermes-agent-wp0p` | Hermes Agent (Hostinger template). Dashboard behind its own login. Data in `./data`. | `https://hermes-agent-wp0p.srv2185949.hstgr.cloud` |

The `.build.log` files show `pioneer-crm` and Hermes were deployed through Hostinger's Docker
manager. **Redeploying from the Hostinger panel can rewrite a compose file**, so after any panel
redeploy, re-check this runbook's settings.

Docker logs rotate (`/etc/docker/daemon.json`: json-file, 10 MB × 3). UFW is inactive, and
Docker-published ports bypass UFW anyway: the only reliable fix for an exposed port is not
publishing it.

## Files and permissions

| File | Holds | Mode |
|---|---|---|
| `/docker/pioneer-crm/.env` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public), `SUPABASE_SECRET_KEY` (invites only) | `600 root` |
| `/docker/pioneer-crm/.env.worker` | Worker settings (database login, Grok/Claude endpoints, sheet IDs) | `600 root` (read by Docker on the host, never mounted) |
| `/docker/pioneer-crm/worker-files/` | `supabase-ca.crt` (public), `google-sheet-reader.json` (secret) | dir `700 root`; CA `644`; Google key `400`, owner uid 1000 (the container's `node` user) |
| `/root/.deploy-keys/` | Read-only GitHub deploy key + pinned `known_hosts` | dir `700`, key `600` |

## The app service

Unchanged from the Hostinger setup except:

- `SUPABASE_SECRET_KEY: ${SUPABASE_SECRET_KEY}` in `environment:` (client invites, D-39).
- **No `ports:`** (pending approval, 2026-11-23): Traefik reaches the app on the internal network;
  a published port exposed the sign-in page over plain HTTP at `http://2.25.104.128:<port>`.

Deploy = `cd /docker/pioneer-crm && docker compose up -d --force-recreate pioneer-crm` (rebuilds
from `main`; about 3–5 minutes of downtime). Backups of the compose file sit next to it as
`docker-compose.yml.bak-*`.

## The worker service (Michael Scott's worker)

Add to `/docker/pioneer-crm/docker-compose.yml` under `services:` (and the `networks:` entry):

```yaml
  pioneer-worker:
    image: node:24-alpine
    restart: unless-stopped
    init: true
    stop_grace_period: 30s
    working_dir: /app
    env_file: .env.worker
    environment:
      WORKER_HEARTBEAT_FILE: /tmp/pioneer-worker/heartbeat
      GIT_SSH_COMMAND: ssh -i /keys/pioneer-crm -o IdentitiesOnly=yes -o UserKnownHostsFile=/keys/known_hosts -o StrictHostKeyChecking=yes
    volumes:
      - /root/.deploy-keys:/keys:ro
      - ./worker-files:/run/pioneer:ro
    command: >-
      sh -c "apk add --no-cache git openssh-client su-exec &&
      if [ ! -d /app/src/.git ]; then git clone --depth 1 git@github.com:bettyp23/pioneer-crm.git /app/src;
      else git -C /app/src fetch --depth 1 origin main && git -C /app/src reset --hard origin/main; fi &&
      cd /app/src && npm ci --include=dev && mkdir -p /tmp/pioneer-worker &&
      chown -R node:node /app/src /tmp/pioneer-worker &&
      exec su-exec node npx tsx worker/index.ts"
    healthcheck:
      test: ["CMD", "node", "/app/src/worker/healthcheck.mjs"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5m
    networks:
      - worker

networks:
  worker:
    name: pioneer-worker
```

What this gives:

- **Non-root runtime.** Setup (packages, clone, `npm ci`) runs as root; the worker itself runs as
  `node` (uid 1000) via `su-exec`.
- **Own network** with outbound internet only. Not on the network the app shares with Hermes;
  no ports, no Traefik labels.
- **Read-only secrets.** The deploy key and `worker-files` are mounted `:ro`; `.env.worker` is
  read by Docker on the host and never mounted.
- **Health.** The worker touches the heartbeat file after every healthy loop. The health check
  fails after 90 s without one. Database calls time out (10 s connect, 30 s query), and after
  5 minutes of continuous failure the worker exits so `restart: unless-stopped` starts it fresh.
- **Clean stops.** `init: true` forwards SIGTERM; the worker finishes its current step, closes
  its database pool and exits within the 30 s grace period.

`.env.worker` (owner fills in values):

```
WORKER_DATABASE_URL=postgresql://pioneer_worker.haorcxcglsilmzqdltrc:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres
WORKER_DATABASE_CA_FILE=/run/pioneer/supabase-ca.crt
WORKER_NAME=vps
WORKER_MODE=hold
GROK_WEBHOOK_URL=
GROK_WEBHOOK_KEY=
CLAUDE_ROUTINE_URL=
CLAUDE_ROUTINE_TOKEN=
GOOGLE_SHEETS_KEY_FILE=/run/pioneer/google-sheet-reader.json
AGENCY_SHEET_ID=
AGENCY_RESULTS_FOLDER_ID=
```

The worker's database login is set in Supabase → SQL Editor (the CLI's admin login is refused on
this Vercel-created project):

```sql
alter role pioneer_worker with login password '<password>' connection limit 4;
```

### First start and going live

1. Start with `WORKER_MODE=hold`: it connects (TLS verified), reports healthy and **claims no
   jobs**, so nothing queued is sent. Check `docker compose ps` shows `healthy` and the log shows
   `worker.holding`.
2. Decide what happens to messages queued while no worker ran (cancel them in the app or let
   them go).
3. Set `WORKER_MODE=run` in `.env.worker` and `docker compose up -d pioneer-worker`.

Only one worker should run per database in normal operation (two are still safe:
`claim_jobs` uses `for update skip locked` and leases).

### Operations

- Logs: `docker compose logs -f pioneer-worker` (JSON lines; no secrets, codes or message text).
- Pause sending without stopping: set `WORKER_MODE=hold` and recreate the service.
- Stop: `docker compose stop pioneer-worker`.
- Rotate the worker password: run the `alter role` line with a new password, update
  `.env.worker`, recreate the service.
