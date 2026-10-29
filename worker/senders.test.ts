import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "./config";
import { callGrok, fireClaude } from "./senders";

const CLAUDE = {
  url: "https://api.anthropic.com/v1/claude_code/routines/trig_SYNTHETIC/fire",
  token: "sk-ant-oat01-synthetic-token",
};
const GROK = { url: "https://grok.example/hook/synthetic", key: "synthetic-key" };

describe("fireClaude", () => {
  it("posts the text with the routine headers and returns the session ID", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ type: "routine_fire", claude_code_session_id: "session_1" }),
    );
    expect(await fireClaude(CLAUDE, "hello", fetchImpl as typeof fetch)).toEqual({
      ok: true,
      externalRef: "session_1",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(CLAUDE.url);
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${CLAUDE.token}`,
      "anthropic-beta": "experimental-cc-routine-2026-04-01",
    });
    expect(JSON.parse(init.body as string)).toEqual({ text: "hello" });
  });

  it("reports refusals and network errors without the URL or token", async () => {
    const refused = await fireClaude(
      CLAUDE,
      "x",
      (async () => new Response("no", { status: 429 })) as unknown as typeof fetch,
    );
    const down = await fireClaude(CLAUDE, "x", (async () => {
      throw new TypeError(`fetch failed for ${CLAUDE.url} with ${CLAUDE.token}`);
    }) as unknown as typeof fetch);
    expect(refused).toEqual({ ok: false, error: "Claude task refused the send (HTTP 429)" });
    expect(down).toEqual({ ok: false, error: "Claude task not reachable (TypeError)" });
  });
});

describe("callGrok", () => {
  it("posts JSON with the Bearer key", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok"));
    const body = { job_id: "j", code: "c", client: null, task: "t", blueprint_id: null };
    expect(await callGrok(GROK, body, fetchImpl as typeof fetch)).toEqual({
      ok: true,
      externalRef: null,
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: "Bearer synthetic-key" });
    expect(JSON.parse(init.body as string)).toEqual(body);
  });
});

describe("loadConfig", () => {
  const base = { WORKER_DATABASE_URL: "postgresql://pioneer_worker:pw@127.0.0.1:54322/postgres" };

  it("needs the restricted worker login, never postgres", () => {
    expect(() =>
      loadConfig({
        WORKER_DATABASE_URL: "postgresql://postgres:secret-pw@127.0.0.1:54322/postgres",
      }),
    ).toThrow(/WORKER_DATABASE_URL/);
    try {
      loadConfig({
        WORKER_DATABASE_URL: "postgresql://postgres:secret-pw@127.0.0.1:54322/postgres",
      });
    } catch (e) {
      expect(String(e)).not.toContain("secret-pw");
    }
  });

  it("turns each connection on only when both of its settings are present", () => {
    const cfg = loadConfig({
      ...base,
      CLAUDE_ROUTINE_URL: CLAUDE.url,
      CLAUDE_ROUTINE_TOKEN: CLAUDE.token,
      GROK_WEBHOOK_URL: GROK.url,
    });
    expect(cfg.claude).not.toBeNull();
    expect(cfg.grok).toBeNull();
    expect(cfg.sheet).toBeNull();
  });

  it("refuses a webhook that isn't https", () => {
    expect(() => loadConfig({ ...base, GROK_WEBHOOK_URL: "http://grok.example/hook" })).toThrow(
      /GROK_WEBHOOK_URL/,
    );
  });
});

describe("loadConfig: hosted database", () => {
  const hosted =
    "postgresql://pioneer_worker.abcdefghijklmnopqrst:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres";

  it("accepts the pooler's pioneer_worker.<project-ref> login with a certificate", () => {
    const cfg = loadConfig({ WORKER_DATABASE_URL: hosted, WORKER_DATABASE_CA_FILE: "/ca.crt" });
    expect(cfg.database).toEqual({ url: hosted, caFile: "/ca.crt" });
  });

  it("refuses a hosted database without a certificate to verify", () => {
    expect(() => loadConfig({ WORKER_DATABASE_URL: hosted })).toThrow(/WORKER_DATABASE_CA_FILE/);
  });

  it("refuses connection options in the URL (TLS is configured by the worker)", () => {
    expect(() =>
      loadConfig({
        WORKER_DATABASE_URL: `${hosted}?sslmode=disable`,
        WORKER_DATABASE_CA_FILE: "/ca.crt",
      }),
    ).toThrow(/WORKER_DATABASE_URL/);
  });

  it("needs no certificate for the local database", () => {
    const local = "postgresql://pioneer_worker:pw@127.0.0.1:54322/postgres";
    expect(loadConfig({ WORKER_DATABASE_URL: local }).database).toEqual({
      url: local,
      caFile: null,
    });
  });
});
