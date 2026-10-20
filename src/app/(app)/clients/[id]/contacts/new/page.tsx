import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { getClient } from "@/features/clients/server/queries";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "New contact" };

export default async function NewContactPage({ params }: PageProps<"/clients/[id]/contacts/new">) {
  await requirePagePermission("records.write");
  const client = await getClient((await params).id);
  return (
    <>
      <PageHeader title="New contact" description={client.name} />
      <ContactForm clientId={client.id} />
    </>
  );
}
