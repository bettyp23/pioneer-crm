import { NextResponse, type NextRequest } from "next/server";

import { getSupabase } from "@/server/auth/session";

// POST only: a GET sign-out could be triggered cross-site by an <img> tag.
export async function POST(request: NextRequest) {
  // Reject cross-origin form posts (CSRF). Browsers always send Origin on POST.
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await getSupabase();
  await supabase.auth.signOut({ scope: "local" });

  // 303 so the browser follows with GET.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
