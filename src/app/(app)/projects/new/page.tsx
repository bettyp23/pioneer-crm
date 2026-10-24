import type { Metadata } from "next";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { GenerateProjectForm } from "@/features/projects/components/generate-project-form";
import { getGenerationOptions } from "@/features/projects/server/queries";
import { dateInZone } from "@/lib/dates";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Generate project" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const { member } = await requirePagePermission("projects.generate");
  const options = await getGenerationOptions();
  const requested = z.uuid().safeParse((await searchParams).client);
  const defaultClientId =
    requested.success && options.clients.some((c) => c.id === requested.data) ? requested.data : "";

  return (
    <>
      <PageHeader
        title="Generate project"
        description="Creates the project, its tasks, dependencies, client inputs and approvals in one step."
      />
      <GenerateProjectForm
        idempotencyKey={crypto.randomUUID()}
        defaultClientId={defaultClientId}
        clients={options.clients}
        sows={options.sows}
        versions={options.versions}
        leads={options.leads}
        today={dateInZone(new Date(), member.workspaceTimezone)}
      />
    </>
  );
}
