// Pioneer worker (M8). Runs on the owner's Mac: `npm run worker`.
// Every 5 s: claim sends and make them (at most once each). Every 60 s: read the results tab,
// match replies, and expire sends whose reply is overdue. Stops cleanly on Ctrl+C.
// It never runs agent code or shell commands, and logs no secrets, codes or message text.
import { loadConfig } from "./config";
import { connect } from "./db";
import { handleSend, SEND_KINDS, sendersFor } from "./handlers";
import { processRows } from "./results";
import { loadServiceAccount, SheetReader } from "./sheet";

const SEND_EVERY_MS = 5_000;
const POLL_EVERY_MS = 60_000;

const log = (event: string, details: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...details }));

async function main() {
  const cfg = loadConfig();
  const db = connect(cfg.databaseUrl);
  const send = sendersFor(cfg);
  const sheet = cfg.sheet
    ? new SheetReader(await loadServiceAccount(cfg.sheet.keyFile), cfg.sheet.sheetId, cfg.sheet.tab)
    : null;
  log("worker.started", {
    worker: cfg.workerName,
    claude: cfg.claude !== null,
    grok: cfg.grok !== null,
    sheet: sheet !== null,
  });
  if (!sheet) log("worker.warning", { message: "No sheet settings: replies won't be read" });

  let stopping = false;
  const stop = () => {
    stopping = true;
    log("worker.stopping");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  let lastPoll = 0;
  while (!stopping) {
    try {
      for (const job of await db.claimJobs(cfg.workerName, SEND_KINDS, 5)) {
        const outcome = await handleSend(job, cfg.workerName, db, send);
        log("send", { job: job.id, kind: job.kind, attempt: job.attempts, outcome });
      }
      if (Date.now() - lastPoll >= POLL_EVERY_MS) {
        lastPoll = Date.now();
        const expired = await db.expireWaiting();
        if (expired) log("replies.expired", { count: expired });
        if (sheet) {
          const summary = await processRows(await sheet.readRows(), db);
          if (summary.new) log("replies.read", summary);
        }
      }
    } catch (e) {
      // Messages only; drivers and fetch don't put credentials in theirs, but never the stack.
      log("worker.error", { message: e instanceof Error ? e.message.slice(0, 300) : "unknown" });
    }
    await new Promise((r) => setTimeout(r, SEND_EVERY_MS));
  }
  await db.close();
  log("worker.stopped");
}

main().catch((e) => {
  log("worker.fatal", { message: e instanceof Error ? e.message.slice(0, 300) : "unknown" });
  process.exit(1);
});
