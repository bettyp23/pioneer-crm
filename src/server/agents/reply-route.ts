import "server-only";

import { agentReplyKey } from "./config";
import { createRateLimiter } from "./rate-limit";
import { handleAgentReply } from "./reply-handler";
import { createAgentStore, type AgentStore } from "./store";

// Process-wide limits for POST /api/agent-reply: 30 per minute per client address, 120 per
// minute overall.
const perClient = createRateLimiter({ limit: 30, windowMs: 60_000 });
const global = createRateLimiter({ limit: 120, windowMs: 60_000 });
let store: AgentStore | null = null;

export function agentReplyRoute(req: Request): Promise<Response> {
  return handleAgentReply(req, {
    store: () => (store ??= createAgentStore()),
    key: agentReplyKey(),
    perClient,
    global,
  });
}
