import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { listMembers } from "@/features/workspace/server/queries";
import { isRole, ROLE_LABELS } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const { member } = await requireMember();
  const members = await listMembers();

  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Inviting members from the app isn&apos;t available yet. The workspace owner adds people
        directly.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Member since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.user_id}>
                <TableCell className="font-medium">
                  {m.profile?.display_name ?? "Unknown user"}
                  {m.user_id === member.userId ? (
                    <span className="text-muted-foreground font-normal"> (you)</span>
                  ) : null}
                </TableCell>
                <TableCell>{isRole(m.role) ? ROLE_LABELS[m.role] : m.role}</TableCell>
                <TableCell>
                  <Badge variant={m.status === "active" ? "secondary" : "outline"}>
                    {m.status === "active" ? "Active" : "Suspended"}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(m.created_at, member.workspaceTimezone)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
