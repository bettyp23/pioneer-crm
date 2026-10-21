import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { listClientOptions } from "@/features/clients/server/queries";
import { listMemberOptions } from "@/features/leads/server/queries";
import { RoutineForm } from "@/features/operations/components/routine-form";
import { dateInZone } from "@/lib/dates";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "New routine" };

export default async function NewRoutinePage() {
  const { member } = await requirePagePermission("records.write");
  const [clients, members] = await Promise.all([listClientOptions(), listMemberOptions()]);
  return (
    <>
      <PageHeader title="New routine" />
      <RoutineForm
        clients={clients}
        members={members}
        defaultValues={{
          name: "",
          description: "",
          client_id: "",
          cadence: "monthly",
          interval_count: "1",
          anchor_on: dateInZone(new Date(), member.workspaceTimezone),
          owner_user_id: members.some((m) => m.id === member.userId) ? member.userId : "",
          runbook_url: "",
          is_active: true,
        }}
      />
    </>
  );
}
