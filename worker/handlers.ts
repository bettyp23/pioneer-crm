import { createHash, randomBytes } from "node:crypto";

import { SENSITIVITY_LABELS, scanForSensitiveContent } from "../src/lib/ai/sensitivity";
import type { WorkerConfig } from "./config";
import type { ClaimedJob, WorkerDb } from "./db";
import { callGrok, claudePayload, fireClaude, grokPayload, type SendResult } from "./senders";

export const SEND_KINDS = ["claude.task", "grok.dispatch"];

// How long a reply may take before the job fails with "no reply" (the code expires with it).
export const WAIT_SECONDS = { "claude.task": 30 * 60, "grok.dispatch": 24 * 60 * 60 } as const;

export const newCode = () => randomBytes(24).toString("base64url");
export const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

// null when that connection isn't configured for this worker.
export type Senders = {
  claude: ((text: string) => Promise<SendResult>) | null;
  grok: ((body: ReturnType<typeof grokPayload>) => Promise<SendResult>) | null;
};

export function sendersFor(cfg: WorkerConfig): Senders {
  const { claude, grok } = cfg;
  return {
    claude: claude ? (text) => fireClaude(claude, text) : null,
    grok: grok ? (body) => callGrok(grok, body) : null,
  };
}

export type Outcome = "sent" | "braked" | "not_held" | "failed" | "blocked";

// One send. The one-time code exists only in memory here; the database stores its hash.
export async function handleSend(
  job: ClaimedJob,
  worker: string,
  db: WorkerDb,
  send: Senders,
  newCodeImpl: () => string = newCode,
): Promise<Outcome> {
  const isClaude = job.kind === "claude.task";
  // Checked before anything is recorded as sent, so it doesn't count toward the loop brake.
  if (isClaude ? !send.claude : !send.grok) {
    await db.failJob(
      job.id,
      worker,
      isClaude
        ? "CLAUDE_ROUTINE_URL/TOKEN are not set for the worker"
        : "GROK_WEBHOOK_URL/KEY are not set for the worker",
    );
    return "failed";
  }
  // A task Pioneer (Claude) routed on is checked again before it leaves for Michael Scott:
  // nobody reviewed that text. Messages you wrote yourself were already checked when you sent them.
  if (!isClaude && typeof job.payload.parent_job_id === "string") {
    const flags = scanForSensitiveContent(String(job.payload.task ?? ""));
    if (flags.length > 0) {
      const kinds = [...new Set(flags.map((f) => SENSITIVITY_LABELS[f.kind]))].join(", ");
      await db.failJob(
        job.id,
        worker,
        `Not sent: the routed task contains ${kinds}. Send it to Michael Scott yourself if it's fine.`,
      );
      return "blocked";
    }
  }

  const code = newCodeImpl();
  const waitSeconds = WAIT_SECONDS[isClaude ? "claude.task" : "grok.dispatch"];
  const begin = await db.beginDispatch(job.id, worker, sha256Hex(code), waitSeconds);
  if (begin === "braked" || begin === "not_held") return begin;
  if (begin === "already_sent") {
    await db.failJob(
      job.id,
      worker,
      "This send may already have gone out before the worker stopped. Check with the recipient before retrying.",
    );
    return "failed";
  }

  const result = isClaude
    ? await send.claude!(claudePayload(job, code))
    : await send.grok!(grokPayload(job, code));
  if (!result.ok) {
    await db.failJob(job.id, worker, result.error);
    return "failed";
  }
  await db.markWaiting(job.id, worker, result.externalRef);
  return "sent";
}
