"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  packageFormSchema,
  packageLineSchema,
  serviceFormSchema,
} from "@/features/catalog/schemas";
import type { ActionResult } from "@/lib/action-result";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

const firstIssue = (e?: z.ZodError) => e?.issues[0]?.message ?? "Invalid input";

export async function saveService(id: unknown, input: unknown): Promise<ActionResult> {
  const serviceId = z
    .uuid()
    .nullable()
    .safeParse(id ?? null);
  const parsed = serviceFormSchema.safeParse(input);
  if (!serviceId.success || !parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { list_price, ...rest } = parsed.data;
  const columns = { ...rest, list_price_minor: list_price, currency: "USD" };
  const { error } = serviceId.data
    ? await supabase
        .from("services")
        .update(columns)
        .eq("id", serviceId.data)
        .eq("workspace_id", member.workspaceId)
    : await supabase.from("services").insert({ ...columns, workspace_id: member.workspaceId });
  if (error) return { ok: false, error: toUserMessage(error, "service.save") };

  revalidatePath("/", "layout");
  redirect("/catalog/services");
}

export async function savePackage(id: unknown, input: unknown): Promise<ActionResult> {
  const packageId = z
    .uuid()
    .nullable()
    .safeParse(id ?? null);
  const parsed = packageFormSchema.safeParse(input);
  if (!packageId.success || !parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { list_price, ...rest } = parsed.data;
  const columns = { ...rest, list_price_minor: list_price, currency: "USD" };
  if (packageId.data) {
    const { error } = await supabase
      .from("packages")
      .update(columns)
      .eq("id", packageId.data)
      .eq("workspace_id", member.workspaceId);
    if (error) return { ok: false, error: toUserMessage(error, "package.save") };
    revalidatePath("/", "layout");
    redirect(`/catalog/packages/${packageId.data}`);
  }
  const { data, error } = await supabase
    .from("packages")
    .insert({ ...columns, workspace_id: member.workspaceId })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserMessage(error, "package.save") };
  revalidatePath("/", "layout");
  redirect(`/catalog/packages/${data.id}`);
}

export async function addPackageLine(input: unknown): Promise<ActionResult> {
  const parsed = packageLineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data: lines, error: listError } = await supabase
    .from("package_services")
    .select("position")
    .eq("package_id", parsed.data.package_id);
  if (listError) return { ok: false, error: toUserMessage(listError, "package_line.add") };
  const position = Math.max(0, ...lines.map((l) => l.position)) + 1;

  const { error } = await supabase
    .from("package_services")
    .insert({ ...parsed.data, position, workspace_id: member.workspaceId });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That service is already included." };
    return { ok: false, error: toUserMessage(error, "package_line.add") };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removePackageLine(
  packageId: unknown,
  serviceId: unknown,
): Promise<ActionResult> {
  const parsed = z
    .object({ packageId: z.uuid(), serviceId: z.uuid() })
    .safeParse({ packageId, serviceId });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;

  const { error } = await auth.ctx.supabase
    .from("package_services")
    .delete()
    .eq("package_id", parsed.data.packageId)
    .eq("service_id", parsed.data.serviceId)
    .eq("workspace_id", auth.ctx.member.workspaceId);
  if (error) return { ok: false, error: toUserMessage(error, "package_line.remove") };
  revalidatePath("/", "layout");
  return { ok: true };
}
