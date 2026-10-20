import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { contactName } from "@/features/contacts/schemas";
import { getContact } from "@/features/contacts/server/queries";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit contact" };

export default async function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  await requirePagePermission("records.write");
  const contact = await getContact((await params).id);
  return (
    <>
      <PageHeader title={`Edit ${contactName(contact)}`} description={contact.client?.name} />
      <ContactForm
        clientId={contact.client_id}
        contactId={contact.id}
        defaultValues={{
          first_name: contact.first_name,
          last_name: contact.last_name ?? "",
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          job_title: contact.job_title ?? "",
          is_primary: contact.is_primary,
          notes: contact.notes ?? "",
        }}
      />
    </>
  );
}
