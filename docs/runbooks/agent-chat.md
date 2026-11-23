# Agent chat: going live and rolling back

Pioneer's chat (`/login/dashboard`) talks to Hermes (receptionist) and Michael Scott (Grok)
directly: the app server POSTs each message to the agent, and agents POST replies to
`/api/agent-reply`. The classic Michael chat (worker + results sheet) stays at
`/login/dashboard/classic`, unchanged; the worker stays in hold mode.

Nothing here has been done in production. **Every step needs the owner's OK at that moment.**

## How it works

```
You ─▶ Pioneer (send_agent_message) ─┬─▶ Michael: POST GROK_MICHAEL_WEBHOOK_URL (Bearer key)
                                      │        └─ Michael POSTs his reply ─▶ /api/agent-reply
                                      └─▶ Hermes (private network) ─▶ answers, or routes:
                                               Pioneer makes the same POST to Michael (from: "hermes")
Replies appear live (Server-Sent Events from /login/api/chat/events).
```

Outbound body to Michael:

```json
{ "type": "chat", "thread_id": "…", "message_id": "…", "from": "bettina" | "hermes",
  "text": "…", "sent_at": "2026-11-23T12:00:00.000Z",
  "reply_url": "https://os.pioneerdigitalai.com/api/agent-reply" }
```

Headers: `Authorization: Bearer <GROK_MICHAEL_WEBHOOK_KEY>`, `Idempotency-Key: <message_id>`.
Retries: up to 4 attempts with 1 s / 2 s / 4 s backoff on 5xx, 429 or network errors; any other
4xx stops at once. A message is claimed once in the database before sending, so it is never
posted twice (even by two requests at the same time). The chat shows "Delivered to Michael",
"Not delivered" (with the reason) or "Not confirmed" (a send that died with the server).

Inbound (`POST /api/agent-reply`), from Michael's routine:

```json
{ "thread_id": "…", "in_reply_to": "<message_id>", "from": "michael",
  "text": "markdown, max 20 KB", "status": "working" | "done" | "needs_decision",
  "links": [{ "label": "…", "url": "https://…" }] }
```

`Authorization: Bearer <PIONEER_AGENT_REPLY_KEY>` or 401. Limits: 30 requests/minute per
address, 120/minute overall (429), body 64 KB (413), text 20 KB (400). Michael can only answer
a message that was sent to him, in its own thread (404 otherwise). The same reply posted twice
is stored once (`duplicate: true`). Markdown is rendered without raw HTML or images; links open
in a new tab with `rel="noopener noreferrer nofollow"`.

## Settings (server `.env`, chmod 600; the owner types the values)

In `/docker/pioneer-crm/.env`:

| Name | What | Where it comes from |
|---|---|---|
| `GROK_MICHAEL_WEBHOOK_URL` | Michael's webhook (https) | Grok routine settings |
| `GROK_MICHAEL_WEBHOOK_KEY` | Bearer key Pioneer sends to Michael | Grok routine settings |
| `PIONEER_AGENT_REPLY_KEY` | Bearer key Michael sends back (32+ characters) | Make one: `openssl rand -hex 32`; put the same value in Michael's routine |
| `HERMES_API_KEY` | Pioneer's key for Hermes's private API | Same value as `API_SERVER_KEY` in `/docker/hermes-agent-wp0p/data/.env` |

Optional: `HERMES_API_URL` (default `http://hermes-agent:8642`), `HERMES_MODEL`.
Never print, log or commit these.

## Go-live steps (stop for an OK before each)

1. **Database.** Apply `supabase/migrations/20261123000100_agent_chat.sql` in the Supabase SQL
   Editor (the CLI's admin login is refused on this project): wrap it in `begin; … commit;`
   with the same "already applied / earlier update missing" checks as the portal update, and
   record version `20261123000100` in `supabase_migrations.schema_migrations`. Additive only:
   the running app is unaffected.
2. **Hermes.** In `/docker/hermes-agent-wp0p/data/.env` set `API_SERVER_HOST=0.0.0.0` (listen
   on the private Docker network; still no published port), turn off every tool for the API
   platform (`platform_toolsets.api_server` empty: a receptionist needs none; today terminal,
   files, code and browser are on), restart Hermes. Check from the app container:
   `wget -qO- --header "Authorization: Bearer …" http://hermes-agent:8642/v1/health` answers,
   and `http://2.25.104.128:8642` is still refused from outside.
3. **Settings.** The owner adds the four values above to `/docker/pioneer-crm/.env`.
4. **Compose (app service), backup first:**
   - pass the four settings in `environment:` (`NAME: ${NAME}` each);
   - deploy a chosen commit for rollback: in the command, replace
     `git -C /app/src fetch --depth 1 origin main && git -C /app/src reset --hard origin/main`
     with
     `git -C /app/src fetch --depth 1 origin ${PIONEER_GIT_REF:-main} && git -C /app/src reset --hard FETCH_HEAD`
     (and the first-time clone stays as is);
   - public path for replies (the app lives under `/login`), Traefik labels:
     ```
     traefik.http.routers.pioneer-agent-reply.rule=Host(`os.pioneerdigitalai.com`) && Path(`/api/agent-reply`)
     traefik.http.routers.pioneer-agent-reply.entrypoints=websecure
     traefik.http.routers.pioneer-agent-reply.tls.certresolver=letsencrypt
     traefik.http.routers.pioneer-agent-reply.service=pioneer-crm
     traefik.http.routers.pioneer-agent-reply.middlewares=pioneer-agent-reply-prefix
     traefik.http.middlewares.pioneer-agent-reply-prefix.addprefix.prefix=/login
     ```
5. **Merge the PR, then deploy:** `cd /docker/pioneer-crm && docker compose up -d --force-recreate pioneer-crm`
   (about 4 minutes of downtime while it builds).
6. **Michael's routine (owner, in Grok):** accept the body above with the webhook key, and POST
   replies to `reply_url` with `PIONEER_AGENT_REPLY_KEY`.
7. **Smoke test:** send "hi" to Hermes (answers itself), then "plan a test page" to Hermes (routes:
   "Sent to Michael Scott" and "Delivered to Michael"), then a direct message to Michael; his
   reply appears without reloading. `curl -X POST https://os.pioneerdigitalai.com/api/agent-reply`
   without a key answers 401.

## Rollback (one command)

Back to the commit before the merge (the database change is additive and the old code ignores
it, so nothing else needs undoing):

```
cd /docker/pioneer-crm && PIONEER_GIT_REF=<commit before the merge> docker compose up -d --force-recreate pioneer-crm
```

To return to the latest `main` later, run the same command without `PIONEER_GIT_REF=…`.
