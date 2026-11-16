import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

// Names only. Values stay in the host's environment and are never logged.

export const HOSTED_WORKER_NAME = "hosted";

type Env = Record<string, string | undefined>;

function trimmed(env: Env, name: string): string | null {
  const value = env[name];
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out === "" ? null : out;
}

function firstSet(env: Env, names: string[]): string | null {
  for (const name of names) {
    const value = trimmed(env, name);
    if (value) return value;
  }
  return null;
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

// The service-role key is sent to this URL. Loopback may be http; anything else must be https.
export function isRelayDatabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (isLoopback(parsed.hostname))
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export type RelayDatabase = { url: string; secret: string };

// SUPABASE_SECRET_KEY is the repo's name for the Supabase secret key (the service_role key).
// SUPABASE_SERVICE_ROLE_KEY is accepted as the same credential when the secret name is unset.
export function readRelayDatabase(env: Env = process.env): RelayDatabase | null {
  const url = trimmed(env, "NEXT_PUBLIC_SUPABASE_URL");
  const secret = firstSet(env, ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (!url || !secret || !isRelayDatabaseUrl(url)) return null;
  return { url, secret };
}

const grokSchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  key: z.string().min(1),
});

export function readGrokWebhook(env: Env = process.env): { url: string; key: string } | null {
  const parsed = grokSchema.safeParse({
    url: trimmed(env, "GROK_WEBHOOK_URL") ?? "",
    key: trimmed(env, "GROK_WEBHOOK_KEY") ?? "",
  });
  return parsed.success ? parsed.data : null;
}

export function readReplyKey(env: Env = process.env): string | null {
  return trimmed(env, "PIONEER_REPLY_KEY");
}

export function bearerToken(authorization: string | null): string | null {
  if (!authorization || authorization.length > 500) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  const token = match?.[1];
  if (!token || token.length > 256) return null;
  return token;
}

// SHA-256 both sides so timingSafeEqual always compares equal-length digests.
export function keysMatch(presented: string, expected: string): boolean {
  const left = createHash("sha256").update(presented).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

// Log text only. Strip anything that might carry a URL or a bearer token.
export function safeLogMessage(error: unknown): string {
  const raw =
    typeof error === "string" ? error : error instanceof Error ? error.message : "unknown";
  return raw
    .replace(/https?:\/\/\S+/gi, "<url>")
    .replace(/bearer\s+\S+/gi, "bearer <redacted>")
    .slice(0, 200);
}
