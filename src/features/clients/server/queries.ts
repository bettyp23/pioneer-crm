import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import type { ClientStatus } from "@/features/clients/schemas";
import { requireMember } from "@/server/auth/session";

export const CLIENT_PAGE_SIZE = 50;

export async function listClients(params: {
  q: string;
  status?: ClientStatus;
  archived: boolean;
  page: number;
}) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("clients")
    .select("id, name, kind, status, industry, archived_at, updated_at", { count: "exact" })
    .eq("workspace_id", member.workspaceId)
    .order("name", { ascending: true })
    .range((params.page - 1) * CLIENT_PAGE_SIZE, params.page * CLIENT_PAGE_SIZE - 1);

  query = params.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (params.status) query = query.eq("status", params.status);
  if (params.q) {
    // Escape LIKE wildcards; PostgREST filter values are parameterized.
    const pattern = `%${params.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    query = query.ilike("name", pattern);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load clients (${error.code})`);
  return { clients: data, total: count ?? 0 };
}

export async function getClient(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load client (${error.code})`);
  if (!data) notFound();
  return data;
}

export async function listClientOptions() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("workspace_id", member.workspaceId)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(`Failed to load clients (${error.code})`);
  return data;
}
