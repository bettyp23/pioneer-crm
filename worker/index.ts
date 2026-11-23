// Pioneer worker (M8). Runs on the VPS in its own container (docs/runbooks/vps.md), or locally
// with `npm run worker`. Every 5 s: claim sends and make them (at most once each). Every 60 s:
// read the results tab, match replies, and expire sends whose reply is overdue. In hold mode
// (WORKER_MODE=hold) it only checks the database and claims nothing. Stops cleanly on
// SIGTERM/Ctrl+C, finishing the current step first.
// It never runs agent code or shell commands, and logs no secrets, codes or message text.
import { readFile } from "node:fs/promises";

import { loadConfig } from "./config";
import { connect } from "./db";
import { handleSend, SEND_KINDS, sendersFor } from "./handlers";
import { processRows } from "./results";
import { FolderReader } from "./folder";
import { writeHeartbeat } from "./heartbeat";
import { GoogleAuth, loadServiceAccount, SheetReader } from "./sheet";

const SEND_EVERY_MS = 5_000;
const POLL_EVERY_MS = 60_000;
// Unhealthy this long in a row: exit so Docker's restart policy starts a fresh process.
const GIVE_UP_AFTER_MS = 5 * 60_000;

const log = (event: string, details: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...details }));

async function main() {
  const cfg = loadConfig();
  const ca = cfg.database.caFile ? await readFile(cfg.database.caFile, "utf8") : null;
  const db = connect(cfg.database.url, ca);
  const send = sendersFor(cfg);
  const google = cfg.googleKeyFile
    ? new GoogleAuth(await loadServiceAccount(cfg.googleKeyFile))
    : null;
  const readers = [
    google && cfg.sheet ? new SheetReader(google, cfg.sheet.sheetId, cfg.sheet.tab) : null,
    google && cfg.folder ? new FolderReader(google, cfg.folder.folderId) : null,
  ].filter((r) => r !== null);
  log("worker.started", {
    worker: cfg.workerName,
    mode: cfg.mode,
    database: ca ? "hosted (TLS verified)" : "local",
    claude: cfg.claude !== null,
    grok: cfg.grok !== null,
    sheet: cfg.sheet !== null && google !== null,
    folder: cfg.folder !== null && google !== null,
  });
  if (readers.length === 0) {
    log("worker.warning", {
      message: "No results sheet or folder settings: replies won't be read",
    });
  }

  let stopping = false;
  const stop = () => {
    stopping = true;
    log("worker.stopping");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  let lastPoll = 0;
  let wasHealthy: boolean | null = null;
  let unhealthySince: number | null = null;
  while (!stopping) {
    let healthy = false;
    try {
      if (cfg.mode === "hold") {
        await db.ping();
        healthy = true;
        if (wasHealthy !== true) log("worker.holding", { message: "Connected; claiming no jobs" });
      } else {
        await work();
        healthy = true;
      }
    } catch (e) {
      // Messages only; drivers and fetch don't put credentials in theirs, but never the stack.
      log("worker.error", { message: e instanceof Error ? e.message.slice(0, 300) : "unknown" });
    }
    if (healthy && cfg.heartbeatFile) {
      await writeHeartbeat(cfg.heartbeatFile).catch((e: unknown) =>
        log("worker.error", {
          message: `heartbeat: ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`,
        }),
      );
    }
    if (healthy !== wasHealthy && wasHealthy !== null) {
      log(healthy ? "worker.recovered" : "worker.unhealthy");
    }
    wasHealthy = healthy;
    unhealthySince = healthy ? null : (unhealthySince ?? Date.now());
    if (unhealthySince !== null && Date.now() - unhealthySince >= GIVE_UP_AFTER_MS) {
      log("worker.giving_up", {
        message: "Unhealthy for 5 minutes; exiting so Docker restarts it",
      });
      await db.close().catch(() => undefined);
      process.exit(1);
    }
    if (!stopping) await new Promise((r) => setTimeout(r, SEND_EVERY_MS));
  }
  await db.close();
  log("worker.stopped");

  async function work() {
    for (const job of await db.claimJobs(cfg.workerName, SEND_KINDS, 5)) {
      const outcome = await handleSend(job, cfg.workerName, db, send);
      log("send", { job: job.id, kind: job.kind, attempt: job.attempts, outcome });
    }
    if (Date.now() - lastPoll >= POLL_EVERY_MS) {
      lastPoll = Date.now();
      const expired = await db.expireWaiting();
      if (expired) log("replies.expired", { count: expired });
      const rows: string[][] = [];
      for (const reader of readers) rows.push(...(await reader.readRows()));
      if (readers.length) {
        const summary = await processRows(rows, db);
        if (summary.new) log("replies.read", summary);
      }
    }
  }
}

main().catch((e) => {
  log("worker.fatal", { message: e instanceof Error ? e.message.slice(0, 300) : "unknown" });
  process.exit(1);
});
