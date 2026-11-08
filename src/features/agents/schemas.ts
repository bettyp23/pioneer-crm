import { z } from "zod";

import { optionalText } from "@/lib/zod-helpers";

// Trimmed for the one-page app (D-38). Work items, proposed actions, budgets and the agent
// roster schemas are on the archive/full-pioneer-os branch; approvals return in Hermes step 8.

// Durable jobs (D-27): run by the Pioneer worker; people only watch, retry and cancel.
export const JOB_STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  waiting_external: "Waiting for reply",
  succeeded: "Done",
  failed: "Failed",
  dead: "Gave up",
  cancelled: "Cancelled",
} as const;
export type JobStatus = keyof typeof JOB_STATUS_LABELS;

export const aiPauseSchema = z.object({ paused: z.boolean(), reason: optionalText(500) });
