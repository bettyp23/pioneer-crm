import { describe, expect, it } from "vitest";

import { buildCsp } from "./csp";

describe("buildCsp", () => {
  const prod = buildCsp({ nonce: "abc", supabaseUrl: "https://xyz.supabase.co", isDev: false });

  it("uses a nonce with strict-dynamic and no unsafe script sources in production", () => {
    expect(prod).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("restricts connections to self and the Supabase origin", () => {
    expect(prod).toContain("connect-src 'self' https://xyz.supabase.co");
  });

  it("forbids framing, plugins and base-uri changes", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("allows eval only in development", () => {
    const dev = buildCsp({ nonce: "abc", supabaseUrl: "http://127.0.0.1:54321", isDev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
});
