import { describe, expect, it } from "vitest";

import {
  bearerToken,
  isRelayDatabaseUrl,
  keysMatch,
  readGrokWebhook,
  readRelayDatabase,
  readReplyKey,
  safeLogMessage,
} from "./secrets";

describe("relay settings", () => {
  it("reads the service-role key by either name and ignores an empty one", () => {
    expect(
      readRelayDatabase({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SECRET_KEY: " secret-a ",
        SUPABASE_SERVICE_ROLE_KEY: "secret-b",
      }),
    ).toEqual({ url: "https://example.supabase.co", secret: "secret-a" });
    expect(
      readRelayDatabase({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: " secret-b ",
      })?.secret,
    ).toBe("secret-b");
    expect(
      readRelayDatabase({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SECRET_KEY: "  ",
      }),
    ).toBeNull();
  });

  it("refuses a cleartext database URL that is not loopback", () => {
    expect(isRelayDatabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isRelayDatabaseUrl("https://example.supabase.co")).toBe(true);
    expect(isRelayDatabaseUrl("http://example.supabase.co")).toBe(false);
    expect(
      readRelayDatabase({
        NEXT_PUBLIC_SUPABASE_URL: "http://example.supabase.co",
        SUPABASE_SECRET_KEY: "secret",
      }),
    ).toBeNull();
  });

  it("requires an https Grok webhook and both halves of the setting", () => {
    expect(
      readGrokWebhook({ GROK_WEBHOOK_URL: "https://grok.example/hook", GROK_WEBHOOK_KEY: "k" }),
    ).toEqual({
      url: "https://grok.example/hook",
      key: "k",
    });
    expect(
      readGrokWebhook({ GROK_WEBHOOK_URL: "http://grok.example/hook", GROK_WEBHOOK_KEY: "k" }),
    ).toBeNull();
    expect(readGrokWebhook({ GROK_WEBHOOK_URL: "https://grok.example/hook" })).toBeNull();
  });

  it("reads the reply key trimmed, and treats a blank one as unset", () => {
    expect(readReplyKey({ PIONEER_REPLY_KEY: "  abc  " })).toBe("abc");
    expect(readReplyKey({ PIONEER_REPLY_KEY: " " })).toBeNull();
    expect(readReplyKey({})).toBeNull();
  });
});

describe("reply key compare", () => {
  it("accepts a bearer token and rejects anything else", () => {
    expect(bearerToken("Bearer secret-key")).toBe("secret-key");
    expect(bearerToken("bearer secret-key")).toBe("secret-key");
    expect(bearerToken("Basic secret-key")).toBeNull();
    expect(bearerToken("Bearer ")).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(`Bearer ${"x".repeat(300)}`)).toBeNull();
  });

  it("matches equal keys, including different lengths, and rejects the wrong key", () => {
    expect(keysMatch("correct-horse", "correct-horse")).toBe(true);
    expect(keysMatch("nope", "correct-horse")).toBe(false);
    expect(keysMatch("correct-horse-extra", "correct-horse")).toBe(false);
    expect(keysMatch("", "correct-horse")).toBe(false);
  });
});

describe("safeLogMessage", () => {
  it("drops URLs and bearer tokens", () => {
    const message = safeLogMessage(
      new Error("POST https://grok.example/hook?k=1 bearer abc123 failed"),
    );
    expect(message).not.toContain("grok.example");
    expect(message).not.toContain("abc123");
    expect(message).toContain("<url>");
    expect(message).toContain("bearer <redacted>");
  });
});
