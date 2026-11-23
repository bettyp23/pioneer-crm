import { z } from "zod";

// Body of POST /api/agent-reply (an agent answering a message Pioneer sent it).

export const MAX_REPLY_TEXT_BYTES = 20 * 1024;
export const MAX_REPLY_BODY_BYTES = 64 * 1024;

// Agents that may post replies, mapped to how they appear in the chat.
export const REPLY_SENDERS = { michael: "michael_scott" } as const;

const httpUrl = z
  .string()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "links must be http(s) URLs");

export const agentReplySchema = z.object({
  thread_id: z.uuid(),
  in_reply_to: z.uuid(),
  from: z.enum(Object.keys(REPLY_SENDERS) as [keyof typeof REPLY_SENDERS]),
  text: z
    .string()
    .refine((v) => v.trim().length > 0, "text is empty")
    .refine((v) => Buffer.byteLength(v, "utf8") <= MAX_REPLY_TEXT_BYTES, "text is over 20 KB"),
  status: z.enum(["working", "done", "needs_decision"]),
  links: z
    .array(z.object({ label: z.string().trim().min(1).max(100), url: httpUrl }))
    .max(10)
    .optional(),
});
export type AgentReply = z.infer<typeof agentReplySchema>;
