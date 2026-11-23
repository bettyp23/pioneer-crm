import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireClient } from "@/server/auth/session";

// Download a shared file: checks the row is the client's own (RLS + explicit filter), then
// sends the browser to a 60-second signed link. Storage policies re-check the client too.
export async function GET(_request: NextRequest, ctx: RouteContext<"/portal/files/[fileId]">) {
  const { fileId } = await ctx.params;
  if (!z.uuid().safeParse(fileId).success) return new NextResponse("Not found", { status: 404 });

  const { supabase, user } = await requireClient();
  const { data: file, error } = await supabase
    .from("client_files")
    .select("storage_path, file_name")
    .eq("id", fileId)
    .eq("client_id", user.client.id)
    .maybeSingle();
  if (error || !file) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error: signError } = await supabase.storage
    .from("client-files")
    .createSignedUrl(file.storage_path, 60, { download: file.file_name });
  if (signError || !signed) {
    console.warn("portal.file_sign_failed", { status: signError?.name });
    return new NextResponse("This file isn't available right now.", { status: 404 });
  }
  const response = NextResponse.redirect(signed.signedUrl, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
