import type { Metadata } from "next";
import Link from "next/link";

import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityForm } from "@/features/activities/components/activity-form";
import { ActivityList } from "@/features/activities/components/activity-list";
import { listActivities } from "@/features/activities/server/queries";
import { contactName } from "@/features/contacts/schemas";
import { listClientContacts } from "@/features/contacts/server/queries";
import { FollowUpForm } from "@/features/follow-ups/components/follow-up-form";
import { FollowUpList } from "@/features/follow-ups/components/follow-up-list";
import { listOpenFollowUps } from "@/features/follow-ups/server/queries";
import { StageBadge } from "@/features/leads/components/lead-table";
import { MoveLeadForm } from "@/features/leads/components/move-lead-form";
import { setLeadArchived } from "@/features/leads/server/actions";
import { getLead, listMemberOptions, listStages } from "@/features/leads/server/queries";
import { listMembers } from "@/features/workspace/server/queries";
import { addDays, formatIsoDate, localDateTimeInZone } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const { member } = await requireMember();
  const lead = await getLead((await params).id);
  const tz = member.workspaceTimezone;
  const [stages, activities, followUps, members, memberOptions, contacts] = await Promise.all([
    listStages(),
    listActivities({ leadId: lead.id }),
    listOpenFollowUps({ leadId: lead.id }),
    listMembers(),
    listMemberOptions(),
    listClientContacts(lead.client_id),
  ]);
  const stage = stages.find((s) => s.id === lead.stage_id);
  const canWrite = can(member.role, "records.write") && !lead.archived_at;
  const names = new Map(members.map((m) => [m.user_id, m.profile?.display_name ?? "Unknown"]));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            <Link href="/pipeline" className="hover:underline">
              Pipeline
            </Link>
            {lead.client ? (
              <>
                {" · "}
                <Link href={`/clients/${lead.client.id}`} className="hover:underline">
                  {lead.client.name}
                </Link>
              </>
            ) : null}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{lead.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StageBadge stage={stage} />
            {lead.archived_at ? <Badge variant="outline">Archived</Badge> : null}
          </div>
        </div>
        {can(member.role, "records.write") ? (
          <div className="flex flex-wrap gap-2">
            {canWrite ? (
              <Button variant="outline" asChild>
                <Link href={`/leads/${lead.id}/edit`}>Edit</Link>
              </Button>
            ) : null}
            <ActionButton
              variant="ghost"
              action={setLeadArchived.bind(null, lead.id, !lead.archived_at)}
              successMessage={lead.archived_at ? "Lead restored" : "Lead archived"}
              confirmMessage={lead.archived_at ? undefined : "Archive this lead?"}
            >
              {lead.archived_at ? "Restore" : "Archive"}
            </ActionButton>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="font-medium">Activity</h2>
            {canWrite ? (
              <ActivityForm
                clientId={lead.client_id}
                leadId={lead.id}
                contacts={contacts.map((c) => ({ id: c.id, name: contactName(c) }))}
                nowLocal={localDateTimeInZone(new Date(), tz)}
                timezone={tz}
              />
            ) : null}
            <ActivityList activities={activities} timezone={tz} names={names} showLead={false} />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="font-medium">Follow-ups</h2>
            {canWrite ? (
              <FollowUpForm
                clientId={lead.client_id}
                leadId={lead.id}
                members={memberOptions}
                defaultAssignee={
                  memberOptions.some((m) => m.id === member.userId) ? member.userId : ""
                }
                defaultDueOn={addDays(followUps.today, 1)}
              />
            ) : null}
            <FollowUpList
              followUps={followUps.followUps}
              today={followUps.today}
              canWrite={canWrite}
              showClient={false}
            />
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          {canWrite ? (
            <section className="flex flex-col gap-2 rounded-md border p-4">
              <h2 className="text-sm font-medium">Stage</h2>
              <MoveLeadForm
                leadId={lead.id}
                leadTitle={lead.title}
                currentStageId={lead.stage_id}
                stages={stages}
              />
            </section>
          ) : null}
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded-md border p-4 text-sm">
            <dt className="text-muted-foreground">Value</dt>
            <dd className="tabular-nums">
              {formatMoney(lead.estimated_value_minor, lead.currency)}
            </dd>
            <dt className="text-muted-foreground">Expected close</dt>
            <dd>{lead.expected_close_on ? formatIsoDate(lead.expected_close_on) : "—"}</dd>
            <dt className="text-muted-foreground">Contact</dt>
            <dd>{lead.contact ? contactName(lead.contact) : "—"}</dd>
            <dt className="text-muted-foreground">Owner</dt>
            <dd>{lead.owner?.profile?.display_name ?? "Unassigned"}</dd>
            <dt className="text-muted-foreground">Source</dt>
            <dd>{lead.source ?? "—"}</dd>
            {lead.closed_at ? (
              <>
                <dt className="text-muted-foreground">Closed</dt>
                <dd>{formatDateTime(lead.closed_at, tz)}</dd>
              </>
            ) : null}
            {lead.lost_reason ? (
              <>
                <dt className="text-muted-foreground">Lost reason</dt>
                <dd>{lead.lost_reason}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Created</dt>
            <dd>{formatDateTime(lead.created_at, tz)}</dd>
          </dl>
        </aside>
      </div>
    </>
  );
}
