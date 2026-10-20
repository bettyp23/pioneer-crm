import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { buildCsp } from "@/lib/security/csp";

// Runs before every page request:
//  1. generates a per-request CSP nonce (docs/security.md §8);
//  2. refreshes the Supabase session cookie;
//  3. redirects visitors without a session to /login.
// This is a coarse gate only. Authorization happens in requireMember() and in RLS.

const PUBLIC_PATHS = ["/login"];

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: forwardHeaders() } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          cacheHeaders = { ...cacheHeaders, ...headers };
        },
      },
    },
  );

  // Validates the JWT and refreshes the session if needed. Do not add code between
  // client creation and this call (Supabase SSR guidance).
  const { data } = await supabase.auth.getClaims();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
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
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
