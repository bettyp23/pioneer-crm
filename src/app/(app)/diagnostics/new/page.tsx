import type { Metadata } from "next";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { listClientOptions } from "@/features/clients/server/queries";
import { listMemberOptions } from "@/features/leads/server/queries";
import { DiagnosticForm } from "@/features/operations/components/diagnostic-form";
import { dateInZone } from "@/lib/dates";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Record diagnostic" };

export default async function NewDiagnosticPage({ searchParams }: PageProps<"/diagnostics/new">) {
  const { member } = await requirePagePermission("records.write");
  const [clients, members] = await Promise.all([listClientOptions(), listMemberOptions()]);
  const requested = z.uuid().safeParse((await searchParams).client);
  return (
    <>
      <PageHeader title="Record diagnostic" />
      <DiagnosticForm
        clients={clients}
        members={members}
        defaultValues={{
          client_id:
            requested.success && clients.some((c) => c.id === requested.data) ? requested.data : "",
          diagnostic_type: "",
          performed_on: dateInZone(new Date(), member.workspaceTimezone),
          performed_by: members.some((m) => m.id === member.userId) ? member.userId : "",
          summary: "",
          score: "",
          report_url: "",
        }}
      />
    </>
  );
}
