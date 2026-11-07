// The CRM is mounted under one prefix so a path proxy can reach pages, server
// actions, and /_next assets without taking the marketing site's /_next or /api.
// Next.js `redirect()` and <Link> add this prefix; do not add it again.

export const APP_BASE_PATH = "/login";

// Browser origin when the path proxy serves the app. Not a redirect target:
// the upstream app must not send visitors here (that loops through the proxy).
export const PUBLISHED_SITE_ORIGIN = "https://pioneerdigitalai.com";

export function publicPath(appPath: string): string {
  if (!appPath.startsWith("/")) throw new Error("App path must start with /");
  return appPath === "/" ? APP_BASE_PATH : `${APP_BASE_PATH}${appPath}`;
}

/** Public pathname. /login-other is not the mount. */
export function isLoginMountPath(pathname: string): boolean {
  return pathname === APP_BASE_PATH || pathname.startsWith(`${APP_BASE_PATH}/`);
}

/** Pathname inside the app (Next proxy strips basePath). `/` is sign-in, not every path. */
export function isPublicAppPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/mfa" || pathname.startsWith("/mfa/");
}

// Sign-out is a cookie-authenticated POST. Allow the host the browser is on,
// plus the published site when a proxy presents a different Host to the app.
// Missing Origin is rejected. No wildcard.
export function isTrustedFormOrigin(origin: string | null, requestOrigin: string): boolean {
  if (!origin) return false;
  return origin === requestOrigin || origin === PUBLISHED_SITE_ORIGIN;
}

type CookieOptions = {
  domain?: string;
  path?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  priority?: "low" | "medium" | "high";
  partitioned?: boolean;
};

// Session cookies are host-only and limited to the mount, so the marketing
// site does not receive them. A matching Path=/ cookie from the previous
// deploy is cleared. SameSite and HttpOnly are left as the auth library set them.
export function scopedAuthCookies(
  name: string,
  value: string,
  options: CookieOptions = {},
): { name: string; value: string; options: CookieOptions }[] {
  const scoped: CookieOptions = { ...options, path: APP_BASE_PATH };
  delete scoped.domain;
  const clearHost: CookieOptions = { ...options, path: "/", maxAge: 0 };
  delete clearHost.domain;
  delete clearHost.expires;
  return [
    { name, value, options: scoped },
    { name, value: "", options: clearHost },
  ];
}

// Same-host bookmarks from before the mount. Destinations stay relative so the
// response never names the public site. basePath: false keeps Next from
// prefixing these a second time (which would loop /login → /login/login).
export const legacyMountRedirects = [
  { source: "/", destination: "/login", permanent: false, basePath: false },
  { source: "/dashboard", destination: "/login/dashboard", permanent: false, basePath: false },
  { source: "/no-access", destination: "/login/no-access", permanent: false, basePath: false },
  // Crawlers request /robots.txt at the host root. The file itself is under the mount.
  { source: "/robots.txt", destination: "/login/robots.txt", permanent: false, basePath: false },
] as const;
