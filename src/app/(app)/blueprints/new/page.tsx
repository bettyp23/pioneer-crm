import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { BlueprintForm } from "@/features/blueprints/components/blueprint-form";
import { listServices } from "@/features/catalog/server/queries";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "New blueprint" };

export default async function NewBlueprintPage() {
  await requirePagePermission("catalog.manage");
  const services = await listServices({ activeOnly: true });
  return (
    <>
      <PageHeader
        title="New blueprint"
        description="Creates the blueprint and an empty draft v1."
      />
      <BlueprintForm services={services.map((s) => ({ id: s.id, name: s.name }))} />
    </>
  );
}
