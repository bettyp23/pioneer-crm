import { hostname } from "node:os";

import { z } from "zod";

// Worker settings, from .env.worker (never from .env.local, the database or the app). Secrets stay in this
// process: they are never logged, stored or put in a message.
const schema = z.object({
  WORKER_DATABASE_URL: z.string().regex(
    // Hosted Supabase poolers name the user "pioneer_worker.<project-ref>".
    /^postgres(ql)?:\/\/pioneer_worker(\.[a-z0-9]+)?:[^?]+$/,
    "must log in as pioneer_worker (never as postgres) and carry no ?options",
  ),
  // Certificate of the hosted database (Supabase → Database settings → SSL); required off this Mac.
  WORKER_DATABASE_CA_FILE: z.string().min(1).optional(),
  WORKER_NAME: z.string().min(1).max(100).optional(),
  CLAUDE_ROUTINE_URL: z
    .string()
    .regex(/^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[A-Za-z0-9_]+\/fire$/)
    .optional(),
  CLAUDE_ROUTINE_TOKEN: z.string().min(1).optional(),
  GROK_WEBHOOK_URL: z.url({ protocol: /^https$/ }).optional(),
  GROK_WEBHOOK_KEY: z.string().min(1).optional(),
  GOOGLE_SHEETS_KEY_FILE: z.string().min(1).optional(),
  AGENCY_SHEET_ID: z
    .string()
    .regex(/^[A-Za-z0-9_-]{20,}$/)
    .optional(),
  AGENCY_SHEET_TAB: z.string().min(1).max(100).default("Pioneer Results"),
  // The shared "Pioneer Results" Drive folder: one new file per reply.
  AGENCY_RESULTS_FOLDER_ID: z
    .string()
    .regex(/^[A-Za-z0-9_-]{10,}$/)
    .optional(),
  // "hold": connect and report healthy, but claim no jobs and send nothing (first start on a
  // new host, maintenance). "run" (default): normal work.
  WORKER_MODE: z.enum(["run", "hold"]).default("run"),
  // File touched after every healthy loop; the container health check reads its age.
  WORKER_HEARTBEAT_FILE: z.string().min(1).optional(),
});

export type WorkerConfig = {
  database: { url: string; caFile: string | null };
  workerName: string;
  claude: { url: string; token: string } | null;
  grok: { url: string; key: string } | null;
  googleKeyFile: string | null;
  sheet: { sheetId: string; tab: string } | null;
  folder: { folderId: string } | null;
  mode: "run" | "hold";
  heartbeatFile: string | null;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): WorkerConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    // Name the setting only; never echo its value.
    const issue = parsed.error.issues[0];
    throw new Error(`Worker setting ${issue?.path.join(".")} is invalid: ${issue?.message}`);
  }
  const e = parsed.data;
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(
    new URL(e.WORKER_DATABASE_URL).hostname,
  );
  if (!local && !e.WORKER_DATABASE_CA_FILE) {
    // Never talk to a hosted database without verifying its certificate.
    throw new Error("Worker setting WORKER_DATABASE_CA_FILE is required for a hosted database");
  }
  return {
    database: { url: e.WORKER_DATABASE_URL, caFile: local ? null : e.WORKER_DATABASE_CA_FILE! },
    workerName: e.WORKER_NAME ?? `mac-${hostname().split(".")[0]}`.slice(0, 100),
    claude:
      e.CLAUDE_ROUTINE_URL && e.CLAUDE_ROUTINE_TOKEN
        ? { url: e.CLAUDE_ROUTINE_URL, token: e.CLAUDE_ROUTINE_TOKEN }
        : null,
    grok:
      e.GROK_WEBHOOK_URL && e.GROK_WEBHOOK_KEY
        ? { url: e.GROK_WEBHOOK_URL, key: e.GROK_WEBHOOK_KEY }
        : null,
    googleKeyFile: e.GOOGLE_SHEETS_KEY_FILE ?? null,
    sheet:
      e.GOOGLE_SHEETS_KEY_FILE && e.AGENCY_SHEET_ID
        ? { sheetId: e.AGENCY_SHEET_ID, tab: e.AGENCY_SHEET_TAB }
        : null,
    folder:
      e.GOOGLE_SHEETS_KEY_FILE && e.AGENCY_RESULTS_FOLDER_ID
        ? { folderId: e.AGENCY_RESULTS_FOLDER_ID }
        : null,
    mode: e.WORKER_MODE,
    heartbeatFile: e.WORKER_HEARTBEAT_FILE ?? null,
  };
}
