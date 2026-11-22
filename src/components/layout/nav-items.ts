import { LayoutDashboard, Users, type LucideIcon } from "lucide-react";

// Minimal Pioneer OS plus the client portal admin. The full sidebar lives on the
// archive/full-pioneer-os branch.
export type NavItem = { label: string; href: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/dashboard/clients", icon: Users },
];
