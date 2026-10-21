import type { Metadata } from "next";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { listClientOptions } from "@/features/clients/server/queries";
import { InvoiceForm } from "@/features/operations/components/invoice-form";
import { listProjectOptions } from "@/features/operations/server/queries";
import { addDays, dateInZone } from "@/lib/dates";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Record invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const { member } = await requirePagePermission("records.write");
  const [clients, projects] = await Promise.all([listClientOptions(), listProjectOptions()]);
  const requested = z
    .uuid()
    .catch("")
    .parse((await searchParams).client);
  const today = dateInZone(new Date(), member.workspaceTimezone);
  return (
    <>
      <PageHeader title="Record invoice" />
      <InvoiceForm
        clients={clients}
        projects={projects}
        defaultValues={{
          client_id: clients.some((c) => c.id === requested) ? requested : "",
          project_id: "",
          external_system: "quickbooks",
          external_number: "",
          external_url: "",
          issued_on: today,
          due_on: addDays(today, 30),
          amount: "",
          status: "sent",
          paid_on: "",
          notes: "",
        }}
      />
    </>
  );
}
