import "server-only";

import { askHermes } from "./hermes";
import { deliverToMichael } from "./michael-webhook";
import { createAgentStore } from "./store";

// Entry point for Server Actions: run the outbound side of a just-sent message. Called inside
// after(), so the owner's page returns at once and the chat updates live as this progresses.
export async function dispatchAgentMessage(agent: "michael" | "hermes", messageId: string) {
  const store = createAgentStore();
  try {
    if (agent === "michael") await deliverToMichael(messageId, { store });
    else await askHermes(messageId, { store });
  } catch (e) {
    console.error(
      JSON.stringify({
        at: new Date().toISOString(),
        event: "agent.dispatch_error",
        message: messageId,
        agent,
        error: e instanceof Error ? e.message.slice(0, 120) : "unknown",
      }),
    );
  }
}
