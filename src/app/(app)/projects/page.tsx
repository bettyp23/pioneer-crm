import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ProjectTable } from "@/features/projects/components/project-table";
import { listProjects } from "@/features/projects/server/queries";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { member } = await requireMember();
  const projects = await listProjects();
  const active = projects.filter((p) => p.status === "active").length;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Projects" description={`${active} active of ${projects.length}`} />
        {can(member.role, "projects.generate") ? (
          <Button asChild>
            <Link href="/projects/new">Generate project</Link>
          </Button>
        ) : null}
      </div>
      <ProjectTable projects={projects} />
    </>
  );
}
