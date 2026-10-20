import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ServiceForm } from "@/features/catalog/components/service-form";
import { getService } from "@/features/catalog/server/queries";
import { minorToInput } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({
  params,
}: PageProps<"/catalog/services/[id]/edit">) {
  await requirePagePermission("catalog.manage");
  const service = await getService((await params).id);
  return (
    <>
      <PageHeader title={`Edit ${service.name}`} />
      <ServiceForm
        serviceId={service.id}
        defaultValues={{
          code: service.code,
          name: service.name,
          category: service.category ?? "",
          description: service.description ?? "",
          list_price: minorToInput(service.list_price_minor),
          is_active: service.is_active,
        }}
      />
    </>
  );
}
