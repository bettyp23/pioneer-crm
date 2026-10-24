import { Badge } from "@/components/ui/badge";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/features/clients/schemas";

const VARIANT: Record<ClientStatus, "default" | "secondary" | "outline"> = {
  prospect: "outline",
  active: "default",
  paused: "secondary",
  former: "secondary",
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge variant={VARIANT[status]}>{CLIENT_STATUS_LABELS[status]}</Badge>;
}
