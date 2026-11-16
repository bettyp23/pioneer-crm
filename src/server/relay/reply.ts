import { createHash } from "node:crypto";

import { z } from "zod";

import { bearerToken, keysMatch } from "./secrets";

// Same content hash as a Pioneer Results row (worker/sheet.ts), so an identical copy is one reply.
export function replyRowKey(parts: {
  jobId: string;
  code: string;
  from: string;
  kind: string;
  client: string;
  text: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify([parts.jobId, parts.code, parts.from, parts.kind, parts.client, parts.text]),
    )
    .digest("hex");
}

const replySchema = z.object({
  job_id: z.uuid(),
  code: z.string().trim().min(1).max(200),
  from: z.literal("michael_scott"),
  kind: z.enum(["result", "needs_decision"]),
  text: z.string().trim().min(1).max(20_000),
  client: z.string().trim().max(200).optional(),
});

export type ReplyAcceptRow = {
  rowKey: string;
  jobId: string;
  code: string;
  from: "michael_scott";
  kind: "result" | "needs_decision";
  client: string;
  text: string;
};

export type ReplyResponse = {
  status: number;
  body: { outcome: string } | { error: string };
  log?: string;
};

// worker.accept_result still checks the job, the code, the sender, the kind and the deadline.
export async function postReply(input: {
  authorization: string | null;
  body: unknown;
  replyKey: string | null;
  databaseConfigured: boolean;
  accept: ((row: ReplyAcceptRow) => Promise<string>) | null;
}): Promise<ReplyResponse> {
  if (!input.replyKey) return { status: 503, body: { error: "Relay unavailable" } };
  const presented = bearerToken(input.authorization);
  if (!presented || !keysMatch(presented, input.replyKey)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  if (!input.databaseConfigured || !input.accept) {
    return { status: 503, body: { error: "Relay unavailable" } };
  }
  const parsed = replySchema.safeParse(input.body);
  if (!parsed.success) return { status: 400, body: { error: "Invalid reply" } };

  const client = parsed.data.client ?? "";
  const row: ReplyAcceptRow = {
    rowKey: replyRowKey({
      jobId: parsed.data.job_id,
      code: parsed.data.code,
      from: parsed.data.from,
      kind: parsed.data.kind,
      client,
      text: parsed.data.text,
    }),
    jobId: parsed.data.job_id,
    code: parsed.data.code,
    from: parsed.data.from,
    kind: parsed.data.kind,
    client,
    text: parsed.data.text,
  };
  try {
    const outcome = await input.accept(row);
    const status = outcome === "accepted" || outcome === "duplicate" ? 200 : 422;
    return { status, body: { outcome } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return {
      status: 500,
      body: { error: "Relay failed" },
      log: message.replace(/https?:\/\/\S+/gi, "<url>").slice(0, 200),
    };
  }
}
