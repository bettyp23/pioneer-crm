import { z } from "zod";

// Who a message goes to (D-29): Pioneer (Claude) decides by default and may route agency work on
// to Michael Scott; "claude" asks Claude for an answer only; "michael_scott" goes straight to
// his webhook.
export const RECIPIENTS = ["auto", "claude", "michael_scott"] as const;
export type Recipient = (typeof RECIPIENTS)[number];
export const RECIPIENT_LABELS: Record<Recipient, string> = {
  auto: "Pioneer decides",
  claude: "Claude (answer only)",
  michael_scott: "Michael Scott (Grok team)",
};

export const AUTHOR_LABELS = {
  owner: "You",
  pioneer: "Pioneer (Claude)",
  michael_scott: "Michael Scott (Grok)",
  system: "Pioneer",
} as const;
export type Author = keyof typeof AUTHOR_LABELS;

export const MESSAGE_KIND_LABELS = {
  message: null,
  answer: null,
  routed: "Sent on to Michael Scott",
  result: null,
  needs_decision: "Needs your decision",
  notice: null,
} as const;
export type MessageKind = keyof typeof MESSAGE_KIND_LABELS;

export const CONNECTION_LABELS = {
  claude_task: "Pioneer (Claude)",
  grok_webhook: "Michael Scott (Grok)",
} as const;
export type Connection = keyof typeof CONNECTION_LABELS;

export const MAX_MESSAGE_LENGTH = 20000;

export const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(MAX_MESSAGE_LENGTH, "Keep it under 20,000 characters."),
  recipient: z.enum(RECIPIENTS),
  // Set after the owner saw the sensitive-content warning and chose to send anyway.
  confirmFlagged: z.boolean(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const resumeConnectionSchema = z.object({
  connection: z.enum(["claude_task", "grok_webhook"]),
});
