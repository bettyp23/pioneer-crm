import { describe, expect, it, vi } from "vitest";

import { createSupabaseRpc } from "./supabase-rpc";

describe("createSupabaseRpc", () => {
  it("calls the relay function with the service key and does not echo a failure body", async () => {
    const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({ message: "secret-in-body" }), { status: 404 }),
    );
    const rpc = createSupabaseRpc(
      { url: "https://example.supabase.co", secret: "service-secret" },
      fetchImpl,
    );
    await expect(rpc("relay_accept_result", { p_code: "one-time" })).rejects.toThrow(
      /relay_accept_result failed \(HTTP 404\)/,
    );
    try {
      await rpc("relay_accept_result", { p_code: "one-time" });
    } catch (error) {
      expect(error instanceof Error ? error.message : "").not.toContain("one-time");
      expect(error instanceof Error ? error.message : "").not.toContain("service-secret");
      expect(error instanceof Error ? error.message : "").not.toContain("secret-in-body");
    }
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://example.supabase.co/rest/v1/rpc/relay_accept_result");
    const headers = new Headers(init?.headers);
    expect(headers.get("apikey")).toBe("service-secret");
    expect(headers.get("authorization")).toBe("Bearer service-secret");
  });
});
