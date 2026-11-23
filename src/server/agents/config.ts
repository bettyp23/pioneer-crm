import "server-only";

// Agent connection settings, read from the server's environment (VPS `.env`, chmod 600). Values
// are never logged, returned to the browser or stored in the database.

export type WebhookTarget = { url: string; key: string };
export type HermesTarget = { url: string; key: string; model: string };

// Public address agents post replies to. Overridable for local tests only.
export const DEFAULT_AGENT_REPLY_URL = "https://os.pioneerdigitalai.com/api/agent-reply";

// HTTPS only, except a local address (tests and the private Docker network for Hermes).
export function isAllowedAgentUrl(raw: string | undefined, allowPrivateHttp = false): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    if (u.username || u.password) return false;
    if (u.protocol === "https:") return true;
    if (u.protocol !== "http:") return false;
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
    return local || allowPrivateHttp;
  } catch {
    return false;
  }
}

export function michaelWebhook(env: NodeJS.ProcessEnv = process.env): WebhookTarget | null {
  const url = env.GROK_MICHAEL_WEBHOOK_URL;
  const key = env.GROK_MICHAEL_WEBHOOK_KEY;
  return url && key && isAllowedAgentUrl(url) ? { url, key } : null;
}

// Hermes is reached only over the private Docker network (plain HTTP inside it is fine).
export function hermesApi(env: NodeJS.ProcessEnv = process.env): HermesTarget | null {
  const url = env.HERMES_API_URL ?? "http://hermes-agent:8642";
  const key = env.HERMES_API_KEY;
  return key && isAllowedAgentUrl(url, true)
    ? { url: url.replace(/\/+$/, ""), key, model: env.HERMES_MODEL ?? "hermes-agent" }
    : null;
}

export function agentReplyKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.PIONEER_AGENT_REPLY_KEY;
  // A short key is a misconfiguration; refuse every reply rather than accept a guessable one.
  return key && key.length >= 32 ? key : null;
}

export function agentReplyUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.PIONEER_AGENT_REPLY_URL || DEFAULT_AGENT_REPLY_URL;
}
