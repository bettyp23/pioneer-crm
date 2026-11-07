import { describe, expect, it, vi } from "vitest";

import { APP_BASE_PATH } from "@/lib/mount";
import {
  APP_MOUNT,
  handleLoginProxy,
  isLoginMountPath,
  relativizeLocation,
  scopeSetCookie,
  UPSTREAM_ORIGIN,
} from "./src/index.js";

function jsonResponse(status: number, headers: HeadersInit = {}, body = "ok") {
  return new Response(body, { status, headers });
}

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

describe("worker mount", () => {
  it("uses the same prefix as the Next app", () => {
    expect(APP_MOUNT).toBe(APP_BASE_PATH);
    expect(isLoginMountPath("/login")).toBe(true);
    expect(isLoginMountPath("/login/dashboard")).toBe(true);
    expect(isLoginMountPath("/login-other")).toBe(false);
    expect(isLoginMountPath("/_next/static/a.js")).toBe(false);
  });

  it("proxies only /login to the CRM and leaves marketing paths on Pages", async () => {
    const fetchImpl = vi.fn<FetchImpl>(async () => jsonResponse(200));

    await handleLoginProxy(new Request("https://pioneerdigitalai.com/login"), {}, fetchImpl);
    await handleLoginProxy(
      new Request("https://pioneerdigitalai.com/login/mfa?x=1"),
      {},
      fetchImpl,
    );
    await handleLoginProxy(new Request("https://pioneerdigitalai.com/"), {}, fetchImpl);
    await handleLoginProxy(new Request("https://pioneerdigitalai.com/services/"), {}, fetchImpl);
    await handleLoginProxy(new Request("https://pioneerdigitalai.com/login-other"), {}, fetchImpl);
    await handleLoginProxy(
      new Request("https://pioneerdigitalai.com/_next/static/a.js"),
      {},
      fetchImpl,
    );
    await handleLoginProxy(new Request("https://pioneerdigitalai.com/api/contact"), {}, fetchImpl);

    const urls = fetchImpl.mock.calls.map((call) => String(call[0]));
    expect(urls[0]).toBe(`${UPSTREAM_ORIGIN}/login`);
    expect(urls[1]).toBe(`${UPSTREAM_ORIGIN}/login/mfa?x=1`);
    for (const url of urls.slice(2))
      expect(url.startsWith("https://pioneer-digital.pages.dev/")).toBe(true);
    expect(urls.some((url) => url.includes("pioneerdigitalai.com"))).toBe(false);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
    expect(headers.get("x-forwarded-host")).toBeNull();
  });

  it("canonicalizes www only for the mount", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200));
    const response = await handleLoginProxy(
      new Request("https://www.pioneerdigitalai.com/login/dashboard?from=www"),
      {},
      fetchImpl,
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://pioneerdigitalai.com/login/dashboard?from=www",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("turns upstream redirects into same-host paths", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(307, { location: `${UPSTREAM_ORIGIN}/login/dashboard` }),
    );
    const response = await handleLoginProxy(
      new Request("https://pioneerdigitalai.com/login"),
      {},
      fetchImpl,
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/login/dashboard");
  });

  it("does not follow a redirect back to the public host", () => {
    expect(
      relativizeLocation(
        "https://pioneerdigitalai.com/login/dashboard",
        "https://pioneerdigitalai.com/login",
        [UPSTREAM_ORIGIN],
      ),
    ).toBe("/login/dashboard");
    expect(
      relativizeLocation(
        "https://accounts.example/callback",
        "https://pioneerdigitalai.com/login",
        [UPSTREAM_ORIGIN],
      ),
    ).toBe("https://accounts.example/callback");
  });

  it("scopes auth cookies to the mount without dropping HttpOnly or Secure", () => {
    const rewritten = scopeSetCookie(
      "sb-auth=token; Domain=pioneer-crm-two.vercel.app; Path=/; HttpOnly; Secure; SameSite=Lax",
    );
    expect(rewritten).toBe("sb-auth=token; Path=/login; HttpOnly; Secure; SameSite=Lax");
    expect(rewritten.toLowerCase()).not.toContain("domain=");
  });

  it("does not forward the session cookie when falling through to Pages", async () => {
    const fetchImpl = vi.fn<FetchImpl>(async () => jsonResponse(200, {}, "marketing"));
    await handleLoginProxy(
      new Request("https://pioneerdigitalai.com/", { headers: { cookie: "sb-auth=secret" } }),
      {},
      fetchImpl,
    );
    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
    expect(headers.get("cookie")).toBeNull();
  });
});
