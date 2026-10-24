import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/features/clients/components/client-form";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requirePagePermission("records.write");
  return (
    <>
      <PageHeader title="New client" />
      <ClientForm />
    </>
  );
}
