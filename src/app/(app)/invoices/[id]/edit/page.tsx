import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { listClientOptions } from "@/features/clients/server/queries";
import { InvoiceForm } from "@/features/operations/components/invoice-form";
import { getInvoice, listProjectOptions } from "@/features/operations/server/queries";
import { minorToInput } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  await requirePagePermission("records.write");
  const [invoice, clients, projects] = await Promise.all([
    getInvoice((await params).id),
    listClientOptions(),
    listProjectOptions(),
  ]);
  return (
    <>
      <PageHeader title={`Edit invoice ${invoice.external_number}`} />
      <InvoiceForm
        invoiceId={invoice.id}
        clients={clients}
        projects={projects}
        defaultValues={{
          client_id: invoice.client_id,
          project_id: invoice.project_id ?? "",
          external_system: invoice.external_system,
          external_number: invoice.external_number,
          external_url: invoice.external_url ?? "",
          issued_on: invoice.issued_on,
          due_on: invoice.due_on ?? "",
          amount: minorToInput(invoice.amount_minor),
          status: invoice.status,
          paid_on: invoice.paid_on ?? "",
          notes: invoice.notes ?? "",
        }}
      />
    </>
  );
}
