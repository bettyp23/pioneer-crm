import { describe, expect, it } from "vitest";

import {
  APP_BASE_PATH,
  isLoginMountPath,
  isPublicAppPath,
  isTrustedFormOrigin,
  legacyMountRedirects,
  PUBLISHED_SITE_ORIGIN,
  publicPath,
  scopedAuthCookies,
} from "@/lib/mount";

describe("login mount paths", () => {
  it("covers the mount and nested routes only", () => {
    expect(isLoginMountPath("/login")).toBe(true);
    expect(isLoginMountPath("/login/mfa")).toBe(true);
    expect(isLoginMountPath("/login/dashboard")).toBe(true);
    expect(isLoginMountPath("/login/_next/static/chunk.js")).toBe(true);
    expect(isLoginMountPath("/login/auth/sign-out")).toBe(true);

    expect(isLoginMountPath("/login-other")).toBe(false);
    expect(isLoginMountPath("/login-other/page")).toBe(false);
    expect(isLoginMountPath("/")).toBe(false);
    expect(isLoginMountPath("/dashboard")).toBe(false);
    expect(isLoginMountPath("/_next/static/chunk.js")).toBe(false);
    expect(isLoginMountPath("/api/contact")).toBe(false);
    expect(isLoginMountPath("/services/")).toBe(false);
  });

  it("maps in-app paths to one public prefix", () => {
    expect(APP_BASE_PATH).toBe("/login");
    expect(publicPath("/")).toBe("/login");
    expect(publicPath("/mfa")).toBe("/login/mfa");
    expect(publicPath("/dashboard")).toBe("/login/dashboard");
    expect(publicPath("/auth/sign-out")).toBe("/login/auth/sign-out");
  });

  it("treats only sign-in and MFA as public inside the app", () => {
    expect(isPublicAppPath("/")).toBe(true);
    expect(isPublicAppPath("/mfa")).toBe(true);
    expect(isPublicAppPath("/mfa/extra")).toBe(true);
    expect(isPublicAppPath("/dashboard")).toBe(false);
    expect(isPublicAppPath("/no-access")).toBe(false);
    expect(isPublicAppPath("/settings/workspace")).toBe(false);
  });
});

describe("form origin allowlist", () => {
  it("accepts the request host and the published site only", () => {
    expect(isTrustedFormOrigin("http://localhost:3000", "http://localhost:3000")).toBe(true);
    expect(isTrustedFormOrigin(PUBLISHED_SITE_ORIGIN, "https://pioneer-crm-two.vercel.app")).toBe(
      true,
    );
    expect(isTrustedFormOrigin(null, "https://pioneer-crm-two.vercel.app")).toBe(false);
    expect(
      isTrustedFormOrigin("http://pioneerdigitalai.com", "https://pioneer-crm-two.vercel.app"),
    ).toBe(false);
    expect(
      isTrustedFormOrigin("https://www.pioneerdigitalai.com", "https://pioneer-crm-two.vercel.app"),
    ).toBe(false);
    expect(isTrustedFormOrigin("https://evil.example", "https://pioneer-crm-two.vercel.app")).toBe(
      false,
    );
  });
});

describe("auth cookies", () => {
  it("scopes the session to the mount and clears a host-wide cookie", () => {
    const [scoped, clear] = scopedAuthCookies("sb-auth", "token", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      domain: "pioneerdigitalai.com",
    });
    expect(scoped).toMatchObject({
      name: "sb-auth",
      value: "token",
      options: { path: "/login", httpOnly: true, secure: true, sameSite: "lax" },
    });
    expect(scoped?.options.domain).toBeUndefined();
    expect(clear).toMatchObject({ name: "sb-auth", value: "", options: { path: "/", maxAge: 0 } });
    expect(clear?.options.domain).toBeUndefined();
    expect(clear?.options.sameSite).toBe("lax");
  });
});

describe("legacy redirects", () => {
  it("stays on the requesting host and does not prefix twice", () => {
    for (const redirect of legacyMountRedirects) {
      expect(redirect.permanent).toBe(false);
      expect(redirect.basePath).toBe(false);
      expect(redirect.destination.startsWith("/login")).toBe(true);
      expect(redirect.destination.includes("://")).toBe(false);
      expect(redirect.source.includes("*")).toBe(false);
      expect(isLoginMountPath(redirect.source)).toBe(false);
    }
    expect(legacyMountRedirects.map((redirect) => redirect.destination)).not.toContain(
      "/login/login",
    );
  });
});
