import { postReply } from "@/server/relay/reply";
import { readRelayDatabase, readReplyKey, safeLogMessage } from "@/server/relay/secrets";
import { createRelayWorkerDb, createSupabaseRpc } from "@/server/relay/supabase-rpc";

export const runtime = "nodejs";
// One database call. Kept above the default so a slow round trip still finishes.
export const maxDuration = 30;

// Public URL: POST /login/api/reply (the app is mounted at /login).
// Authorization: Bearer <PIONEER_REPLY_KEY>
// Body: { job_id, code, from: "michael_scott", kind: "result" | "needs_decision", text, client? }
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const database = readRelayDatabase();
  const db = database ? createRelayWorkerDb(createSupabaseRpc(database)) : null;
  const result = await postReply({
    authorization: request.headers.get("authorization"),
    body,
    replyKey: readReplyKey(),
    databaseConfigured: database !== null,
    accept: db ? (row) => db.acceptResult(row) : null,
  });
  if (result.log) {
    console.error(
      JSON.stringify({ event: "relay.reply_error", message: safeLogMessage(result.log) }),
    );
  }
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
