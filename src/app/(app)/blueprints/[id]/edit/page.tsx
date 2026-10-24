import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { BlueprintForm } from "@/features/blueprints/components/blueprint-form";
import { getBlueprint } from "@/features/blueprints/server/queries";
import { listServices } from "@/features/catalog/server/queries";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit blueprint" };

export default async function EditBlueprintPage({ params }: PageProps<"/blueprints/[id]/edit">) {
  await requirePagePermission("catalog.manage");
  const [bp, services] = await Promise.all([getBlueprint((await params).id), listServices()]);
  return (
    <>
      <PageHeader
        title={`Edit ${bp.name}`}
        description="Name and description only. Tasks live in versions."
      />
      <BlueprintForm
        blueprintId={bp.id}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        defaultValues={{
          name: bp.name,
          description: bp.description ?? "",
          service_id: bp.service_id ?? "",
        }}
      />
    </>
  );
}
