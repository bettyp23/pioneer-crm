import { NextResponse, type NextRequest } from "next/server";

import { isTrustedFormOrigin, publicPath } from "@/lib/mount";
import { getSupabase } from "@/server/auth/session";

// POST only: a GET sign-out could be triggered cross-site by an <img> tag.
export async function POST(request: NextRequest) {
  // Reject cross-origin form posts (CSRF). Browsers always send Origin on POST.
  const origin = request.headers.get("origin");
  if (!isTrustedFormOrigin(origin, request.nextUrl.origin)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await getSupabase();
  await supabase.auth.signOut({ scope: "local" });

  // 303 so the browser follows with GET. Location uses this request's host.
  // The path proxy rewrites an upstream host to a path; do not name the public site.
  return NextResponse.redirect(new URL(publicPath("/"), request.url), { status: 303 });
}
