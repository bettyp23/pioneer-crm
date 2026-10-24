import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { listClientOptions } from "@/features/clients/server/queries";
import { listMemberOptions } from "@/features/leads/server/queries";
import { RoutineForm } from "@/features/operations/components/routine-form";
import { getRoutine } from "@/features/operations/server/queries";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit routine" };

export default async function EditRoutinePage({ params }: PageProps<"/routines/[id]/edit">) {
  await requirePagePermission("records.write");
  const [routine, clients, members] = await Promise.all([
    getRoutine((await params).id),
    listClientOptions(),
    listMemberOptions(),
  ]);
  return (
    <>
      <PageHeader
        title={`Edit ${routine.name}`}
        description="Changing the schedule only affects future occurrences."
      />
      <RoutineForm
        routineId={routine.id}
        clients={clients}
        members={members}
        defaultValues={{
          name: routine.name,
          description: routine.description ?? "",
          client_id: routine.client_id ?? "",
          cadence: routine.cadence,
          interval_count: String(routine.interval_count),
          anchor_on: routine.anchor_on,
          owner_user_id: routine.owner_user_id ?? "",
          runbook_url: routine.runbook_url ?? "",
          is_active: routine.is_active,
        }}
      />
    </>
  );
}
