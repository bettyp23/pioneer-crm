import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/features/clients/components/client-form";
import { getClient } from "@/features/clients/server/queries";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  await requirePagePermission("records.write");
  const client = await getClient((await params).id);

  return (
    <>
      <PageHeader title={`Edit ${client.name}`} />
      <ClientForm
        clientId={client.id}
        defaultValues={{
          name: client.name,
          legal_name: client.legal_name ?? "",
          kind: client.kind,
          status: client.status,
          industry: client.industry ?? "",
          website_url: client.website_url ?? "",
          drive_folder_url: client.drive_folder_url ?? "",
          notes: client.notes ?? "",
        }}
      />
    </>
  );
}
