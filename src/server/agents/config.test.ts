import { describe, expect, it } from "vitest";

import { agentReplyKey, hermesApi, isAllowedAgentUrl, michaelWebhook } from "./config";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

describe("agent config", () => {
  it("allows https, and http only locally (or on the private network for Hermes)", () => {
    expect(isAllowedAgentUrl("https://grok.example.test/hook")).toBe(true);
    expect(isAllowedAgentUrl("http://grok.example.test/hook")).toBe(false);
    expect(isAllowedAgentUrl("http://127.0.0.1:54400/hook")).toBe(true);
    expect(isAllowedAgentUrl("http://hermes-agent:8642", true)).toBe(true);
    expect(isAllowedAgentUrl("https://user:pass@x.test")).toBe(false);
    expect(isAllowedAgentUrl("ftp://x.test")).toBe(false);
  });
  it("needs both webhook URL and key", () => {
    expect(michaelWebhook(env({ GROK_MICHAEL_WEBHOOK_URL: "https://x.test" }))).toBeNull();
  });
  it("refuses a short reply key", () => {
    expect(agentReplyKey(env({ PIONEER_AGENT_REPLY_KEY: "short" }))).toBeNull();
    expect(agentReplyKey(env({ PIONEER_AGENT_REPLY_KEY: "x".repeat(32) }))).toBe("x".repeat(32));
  });
  it("defaults Hermes to the private network address", () => {
    expect(hermesApi(env({ HERMES_API_KEY: "k" }))?.url).toBe("http://hermes-agent:8642");
  });
});
