import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/server/auth/session";

export async function listServices({ activeOnly = false } = {}) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("services")
    .select("id, code, name, category, description, list_price_minor, currency, is_active")
    .eq("workspace_id", member.workspaceId)
    .order("name");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load services (${error.code})`);
  return data;
}

export async function getService(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load service (${error.code})`);
  if (!data) notFound();
  return data;
}

export async function listPackages() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("packages")
    .select(
      "id, name, description, list_price_minor, currency, is_active, lines:package_services(quantity, service:services!package_services_service_fkey(name))",
    )
    .eq("workspace_id", member.workspaceId)
    .order("name");
  if (error) throw new Error(`Failed to load packages (${error.code})`);
  return data;
}

export async function getPackage(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("packages")
    .select(
      "*, lines:package_services(service_id, quantity, position, service:services!package_services_service_fkey(id, code, name, list_price_minor, currency, is_active))",
    )
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load package (${error.code})`);
  if (!data) notFound();
  return { ...data, lines: [...data.lines].sort((a, b) => a.position - b.position) };
}
