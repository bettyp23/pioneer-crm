import { LayoutDashboard, type LucideIcon } from "lucide-react";

// Minimal Pioneer OS: one page. The full sidebar lives on the archive/full-pioneer-os branch.
export type NavItem = { label: string; href: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
];
