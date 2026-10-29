# Running the Pioneer worker (M8)

The worker is a small program on your Mac. Every 5 seconds it sends new messages to Pioneer
(Claude) or Michael Scott (Grok); every 60 seconds it reads the **Pioneer Results** tab and puts
replies into the chat. It doesn't run agent code or shell commands.

## Once

1. `npm run worker:setup-local`: lets the restricted `pioneer_worker` database role log in to
   your local database and saves `WORKER_DATABASE_URL` to `.env.worker`.
2. Fill in the rest of `.env.worker` (template: `.env.worker.example`). It holds the Claude task
   URL and token, Michael Scott's webhook URL and key, and the Google key file and sheet ID. It is
   separate from `.env.local` so the Pioneer app never loads these secrets. Never commit it or
   paste its values into a chat.

Run the setup again after `npm run db:reset` only if the worker reports a login error.

## Every time

```bash
npm run worker
```

Leave the terminal open. Stop it with **Ctrl+C**. It prints one line of JSON per event, for
example `{"event":"send","kind":"claude.task","outcome":"sent"}`. It never prints URLs, keys,
one-time codes or message text.

- `"claude": false` / `"grok": false` / `"sheet": false` at start-up means that connection's
  settings are missing from `.env.worker`. Sends to it fail with a clear reason in the chat.
- Your Mac must be awake. Sends wait in the queue while it sleeps; replies wait in the sheet.

## When something looks wrong

| You see | Meaning | Do |
|---|---|---|
| Chat says "is paused: N tasks were sent in the last hour" | The loop brake stopped that connection | Check the chat and Jobs for a loop, then **Agents → Usage → Resume** |
| Job "Failed: … may already have gone out" | The worker stopped mid-send | Ask the recipient whether it arrived before you press **Retry** |
| Job "Failed: No reply … before the deadline" | No matching row in the sheet (30 min for Claude, 24 h for Michael Scott) | Check the tab; **Retry** sends once more with a new code |
| Job "Failed: Not sent: the routed task contains …" | Pioneer routed text with contact details or a key | Read it in the chat; send it to Michael Scott yourself if it's fine |
| `worker.error` lines | Database, Google or network problem; the worker keeps trying | Read the message; restart the worker if it repeats |
| "Pause all agents" is on | Kill switch | Nothing is sent until you resume |

## Local test data

The end-to-end tests cancel their own sends. If you ran other experiments, `npm run db:reset`
before starting the worker makes sure no old test message is sent for real.
