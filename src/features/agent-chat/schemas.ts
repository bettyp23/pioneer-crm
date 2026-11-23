import { z } from "zod";

// The agents you can talk to in Pioneer's chat. Hermes answers quick questions and routes the
// rest to a Grok bot; Michael Scott is reached directly through his webhook.
export const AGENTS = {
  hermes: {
    name: "Hermes",
    description: "Receptionist: answers quick questions and routes messages to the right Grok bot.",
    placeholder: "Ask Hermes…",
  },
  michael: {
    name: "Michael Scott",
    description: "Your Grok team lead, reached directly through his webhook.",
    placeholder: "Message Michael…",
  },
} as const;
export type AgentKey = keyof typeof AGENTS;
export const AGENT_KEYS = Object.keys(AGENTS) as AgentKey[];
export const isAgentKey = (v: unknown): v is AgentKey => typeof v === "string" && v in AGENTS;

export const AUTHOR_NAMES: Record<string, string> = {
  owner: "You",
  hermes: "Hermes",
  michael_scott: "Michael Scott",
  system: "Pioneer",
};

export const DELIVERY_LABELS = {
  pending: "Sending…",
  sending: "Sending…",
  delivered: "Delivered to Michael",
  failed: "Not delivered",
} as const;
export type DeliveryStatus = keyof typeof DELIVERY_LABELS;

export const AGENT_STATUS_LABELS = {
  working: "Working on it",
  done: null,
  needs_decision: "Needs your decision",
} as const;
export type AgentStatus = keyof typeof AGENT_STATUS_LABELS;

export const MAX_AGENT_MESSAGE_LENGTH = 20000;

export const sendAgentMessageSchema = z.object({
  agent: z.enum(AGENT_KEYS as [AgentKey, ...AgentKey[]]),
  body: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(MAX_AGENT_MESSAGE_LENGTH, "Keep it under 20,000 characters."),
  confirmFlagged: z.boolean(),
});

export const linksSchema = z
  .array(z.object({ label: z.string(), url: z.string() }))
  .max(10)
  .catch([]);
