import { getClaims, getSupabase } from "@/server/auth/session";

// Server-Sent Events for one chat thread: sends "change" whenever a message or a delivery status
// in it changes. Uses the viewer's own session, so RLS decides access (staff with MFA); anyone
// else gets 401/404. Checks the database every 1.5 s and closes after 5 minutes (the browser
// reconnects). Sends ids and timestamps only, never message text.
export const dynamic = "force-dynamic";

const POLL_MS = 1500;
const MAX_MS = 5 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const threadId = new URL(request.url).searchParams.get("thread") ?? "";
  if (!UUID.test(threadId)) return new Response("Bad thread", { status: 400 });
  const claims = await getClaims();
  if (!claims) return new Response("Unauthorized", { status: 401 });
  const supabase = await getSupabase();

  const { data: thread } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return new Response("Not found", { status: 404 });

  const signature = async () => {
    const [{ data: latest }, { data: deliveries }] = await Promise.all([
      supabase
        .from("messages")
        .select("id, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("agent_deliveries")
        .select("updated_at, message:messages!agent_deliveries_message_fkey!inner(thread_id)")
        .eq("message.thread_id", threadId)
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);
    return `${latest?.[0]?.id ?? ""}|${deliveries?.[0]?.updated_at ?? ""}`;
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now();
      let last = await signature();
      let ticks = 0;
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      while (!request.signal.aborted && Date.now() - started < MAX_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (request.signal.aborted) break;
        try {
          const now = await signature();
          if (now !== last) {
            last = now;
            controller.enqueue(encoder.encode(`event: change\ndata: {}\n\n`));
          } else if (++ticks % 10 === 0) {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          }
        } catch {
          break;
        }
      }
      try {
        controller.close();
      } catch {
        // already closed by the client
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
