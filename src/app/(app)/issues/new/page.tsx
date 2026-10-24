import type { Metadata } from "next";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { listClientOptions } from "@/features/clients/server/queries";
import { listMemberOptions } from "@/features/leads/server/queries";
import { IssueForm } from "@/features/operations/components/issue-form";
import { listDiagnostics } from "@/features/operations/server/queries";
import { formatIsoDate } from "@/lib/dates";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Open issue" };

export default async function NewIssuePage({ searchParams }: PageProps<"/issues/new">) {
  await requirePagePermission("records.write");
  const [clients, members, diagnostics] = await Promise.all([
    listClientOptions(),
    listMemberOptions(),
    listDiagnostics(),
  ]);
  const sp = await searchParams;
  const fromDiagnostic = diagnostics.find((d) => d.id === z.uuid().catch("").parse(sp.diagnostic));
  const requestedClient = z.uuid().catch("").parse(sp.client);
  return (
    <>
      <PageHeader title="Open issue" />
      <IssueForm
        clients={clients}
        members={members}
        diagnostics={diagnostics.map((d) => ({
          id: d.id,
          clientId: d.client_id,
          name: `${d.diagnostic_type} (${formatIsoDate(d.performed_on)})`,
        }))}
        defaultValues={{
          client_id:
            fromDiagnostic?.client_id ??
            (clients.some((c) => c.id === requestedClient) ? requestedClient : ""),
          diagnostic_id: fromDiagnostic?.id ?? "",
          title: "",
          description: "",
          severity: "medium",
          assignee_user_id: "",
        }}
      />
    </>
  );
}
