import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { TabNav } from "@/components/layout/tab-nav";
import { FollowUpList } from "@/features/follow-ups/components/follow-up-list";
import { followUpBucket, followUpScopeSchema } from "@/features/follow-ups/schemas";
import { listOpenFollowUps } from "@/features/follow-ups/server/queries";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Follow-ups" };

const SECTIONS = [
  { key: "overdue", title: "Overdue" },
  { key: "today", title: "Due today" },
  { key: "upcoming", title: "Upcoming" },
] as const;

export default async function FollowUpsPage({ searchParams }: PageProps<"/follow-ups">) {
  const { member } = await requireMember();
  const scope = followUpScopeSchema.parse((await searchParams).scope);
  const { followUps, today } = await listOpenFollowUps({ scope });
  const canWrite = can(member.role, "records.write");

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Add follow-ups from a client or lead. Dates use the workspace timezone."
      />
      <TabNav
        label="Follow-up scope"
        active={scope}
        tabs={[
          { key: "mine", label: "Mine & unassigned", href: "/follow-ups" },
          { key: "all", label: "Everyone", href: "/follow-ups?scope=all" },
        ]}
      />
      {SECTIONS.map((section) => {
        const items = followUps.filter((f) => followUpBucket(f.due_on, today) === section.key);
        return (
          <section key={section.key} className="flex flex-col gap-2">
            <h2 className="font-medium">
              {section.title}{" "}
              <span className="text-muted-foreground font-normal">({items.length})</span>
            </h2>
            <FollowUpList
              followUps={items}
              today={today}
              canWrite={canWrite}
              emptyTitle={`Nothing ${section.key === "upcoming" ? "upcoming" : section.title.toLowerCase()}`}
            />
          </section>
        );
      })}
    </>
  );
}
