import { agentReplyRoute } from "@/server/agents/reply-route";

// Inbound replies from agents (Michael Scott's Grok routine). Public URL
// https://os.pioneerdigitalai.com/api/agent-reply (Traefik adds the /login mount prefix).
// Authenticated with a bearer key, not a session; see src/server/agents/reply-handler.ts.
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return agentReplyRoute(request);
}
