import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { APP_BASE_PATH, isPublicAppPath, scopedAuthCookie } from "@/lib/mount";
import { buildCsp } from "@/lib/security/csp";

// Runs before every page request:
//  1. generates a per-request CSP nonce (docs/security.md §8);
//  2. refreshes the Supabase session cookie;
//  3. redirects visitors without a session to the sign-in page (/login on the public host).
// This is a coarse gate only. Authorization happens in requireMember() and in RLS.

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    isDev: process.env.NODE_ENV === "development",
  });

  const forwardHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return headers;
  };

  let response = NextResponse.next({ request: { headers: forwardHeaders() } });
  let cacheHeaders: Record<string, string> = {};
  let pendingCookies: ReturnType<typeof scopedAuthCookie>[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookieOptions: { path: APP_BASE_PATH },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          pendingCookies = cookiesToSet.map(({ name, value, options }) => {
            request.cookies.set(name, value);
            return scopedAuthCookie(name, value, options);
          });
          response = NextResponse.next({ request: { headers: forwardHeaders() } });
          for (const cookie of pendingCookies) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          }
          cacheHeaders = { ...cacheHeaders, ...headers };
        },
      },
    },
  );

  // Validates the JWT and refreshes the session if needed. Do not add code between
  // client creation and this call (Supabase SSR guidance).
  const { data } = await supabase.auth.getClaims();

  // pathname has basePath stripped. Sign-in is `/` → public /login. MFA is `/mfa`.
  const { pathname } = request.nextUrl;

  if (!data?.claims && !isPublicAppPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    // Absolute on the request host (the vercel.app host behind the proxy).
    // A path-only Location makes Next throw. The worker turns an upstream
    // absolute Location into a path so the browser does not leave its host,
    // and this app never redirects to pioneerdigitalai.com.
    const redirect = NextResponse.redirect(url);
    for (const cookie of pendingCookies) {
      redirect.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    response = redirect;
  }

  response.headers.set("Content-Security-Policy", csp);
  for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except static assets and metadata files.
      source:
        "/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|apple-icon|app-icon/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
