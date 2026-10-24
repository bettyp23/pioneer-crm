import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ServiceForm } from "@/features/catalog/components/service-form";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "New service" };

export default async function NewServicePage() {
  await requirePagePermission("catalog.manage");
  return (
    <>
      <PageHeader title="New service" />
      <ServiceForm />
    </>
  );
}
