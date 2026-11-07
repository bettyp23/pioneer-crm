// Path proxy for the CRM mount only. Marketing Pages keeps every other path.
// Never fetch the public hostname: that request would re-enter this worker.

export const APP_MOUNT = "/login";
export const UPSTREAM_ORIGIN = "https://pioneer-crm-two.vercel.app";
export const PAGES_ORIGIN = "https://pioneer-digital.pages.dev";
export const PUBLIC_APEX_HOST = "pioneerdigitalai.com";
export const PUBLIC_WWW_HOST = "www.pioneerdigitalai.com";

const PUBLIC_HOSTS = new Set([PUBLIC_APEX_HOST, PUBLIC_WWW_HOST]);

export function isLoginMountPath(pathname) {
  return pathname === APP_MOUNT || pathname.startsWith(`${APP_MOUNT}/`);
}

export function assertUpstream(origin) {
  const url = new URL(origin);
  if (url.protocol !== "https:") throw new Error("Upstream must be https");
  if (PUBLIC_HOSTS.has(url.hostname) || url.hostname.endsWith(".pages.dev")) {
    throw new Error("Refusing to proxy the CRM mount to the public site");
  }
  return url.origin;
}

// Absolute redirects to the upstream or the public site become path-only so the
// browser stays on whichever host it used, and the worker does not loop.
export function relativizeLocation(location, requestUrl, knownOrigins) {
  const resolved = new URL(location, requestUrl);
  const known = new Set(knownOrigins.map((origin) => new URL(origin).origin));
  const requestOrigin = new URL(requestUrl).origin;
  if (
    known.has(resolved.origin) ||
    resolved.origin === requestOrigin ||
    PUBLIC_HOSTS.has(resolved.hostname)
  ) {
    return `${resolved.pathname}${resolved.search}`;
  }
  return location;
}

export function scopeSetCookie(cookie) {
  const parts = cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const [pair, ...attrs] = parts;
  if (!pair) return cookie;
  const kept = [];
  let sawPath = false;
  for (const attr of attrs) {
    const eq = attr.indexOf("=");
    const name = (eq === -1 ? attr : attr.slice(0, eq)).trim().toLowerCase();
    if (name === "domain") continue;
    if (name === "path") {
      const value = eq === -1 ? "/" : attr.slice(eq + 1).trim();
      const path = value === APP_MOUNT || value.startsWith(`${APP_MOUNT}/`) ? value : APP_MOUNT;
      kept.push(`Path=${path}`);
      sawPath = true;
      continue;
    }
    kept.push(attr);
  }
  if (!sawPath) kept.push(`Path=${APP_MOUNT}`);
  return [pair, ...kept].join("; ");
}

function forwardedHeaders(request, { dropCookie }) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("x-forwarded-host");
  headers.delete("x-middleware-subrequest");
  if (dropCookie) {
    headers.delete("cookie");
    headers.delete("authorization");
  }
  return headers;
}

async function proxyTo(request, target, fetchImpl, { scopeCookies, knownOrigins }) {
  const init = {
    method: request.method,
    headers: forwardedHeaders(request, { dropCookie: !scopeCookies }),
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;
  const upstream = await fetchImpl(target, init);
  const headers = new Headers(upstream.headers);
  const location = headers.get("location");
  if (location) headers.set("location", relativizeLocation(location, request.url, knownOrigins));
  if (scopeCookies && typeof upstream.headers.getSetCookie === "function") {
    const cookies = upstream.headers.getSetCookie();
    headers.delete("set-cookie");
    for (const cookie of cookies) headers.append("set-cookie", scopeSetCookie(cookie));
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export async function handleLoginProxy(request, env = {}, fetchImpl = globalThis.fetch) {
  const incoming = new URL(request.url);

  if (isLoginMountPath(incoming.pathname)) {
    if (incoming.hostname === PUBLIC_WWW_HOST) {
      const apex = new URL(incoming.toString());
      apex.hostname = PUBLIC_APEX_HOST;
      apex.protocol = "https:";
      return Response.redirect(apex.toString(), 308);
    }
    const upstreamOrigin = assertUpstream(env.UPSTREAM_ORIGIN || UPSTREAM_ORIGIN);
    const target = new URL(`${incoming.pathname}${incoming.search}`, upstreamOrigin);
    return proxyTo(request, target, fetchImpl, {
      scopeCookies: true,
      knownOrigins: [upstreamOrigin, PAGES_ORIGIN],
    });
  }

  // Invoked outside the mount (route attached too widely). Serve Pages from
  // pages.dev — never from the public hostname, which would call this worker again.
  const pagesUrl = new URL(`${incoming.pathname}${incoming.search}`, PAGES_ORIGIN);
  return proxyTo(request, pagesUrl, fetchImpl, {
    scopeCookies: false,
    knownOrigins: [PAGES_ORIGIN, UPSTREAM_ORIGIN],
  });
}

export default {
  async fetch(request, env) {
    return handleLoginProxy(request, env);
  },
};
