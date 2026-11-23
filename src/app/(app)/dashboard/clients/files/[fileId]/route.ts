import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireMember } from "@/server/auth/session";

// Staff download of a shared file (same as the client sees). RLS limits it to the workspace.
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/dashboard/clients/files/[fileId]">,
) {
  const { fileId } = await ctx.params;
  if (!z.uuid().safeParse(fileId).success) return new NextResponse("Not found", { status: 404 });

  const { supabase, member } = await requireMember();
  const { data: file, error } = await supabase
    .from("client_files")
    .select("storage_path, file_name")
    .eq("id", fileId)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error || !file) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error: signError } = await supabase.storage
    .from("client-files")
    .createSignedUrl(file.storage_path, 60, { download: file.file_name });
  if (signError || !signed) return new NextResponse("File not available", { status: 404 });
  const response = NextResponse.redirect(signed.signedUrl, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
