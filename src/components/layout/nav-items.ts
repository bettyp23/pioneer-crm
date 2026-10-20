import {
  BarChart3,
  Bot,
  CalendarCheck,
  CheckSquare,
  ClipboardList,
  Contact,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Package,
  Receipt,
  Repeat,
  Settings,
  Stethoscope,
  TriangleAlert,
  Users,
  Workflow,
} from "lucide-react";

// Sidebar navigation for every module in the screen map (docs/architecture.md §8).
// Modules not built yet show their milestone instead of linking to a broken page.
const CURRENT_MILESTONE = 3;
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  milestone: number;
  available: boolean;
};

export type NavSection = { label: string; items: NavItem[] };

const item = (label: string, href: string, icon: LucideIcon, milestone: number): NavItem => ({
  label,
  href,
  icon,
  milestone,
  available: milestone <= CURRENT_MILESTONE,
});

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [item("Dashboard", "/dashboard", LayoutDashboard, 1)],
  },
  {
    label: "Relationships",
    items: [
      item("Clients", "/clients", Users, 2),
      item("Contacts", "/contacts", Contact, 2),
      item("Pipeline", "/pipeline", Workflow, 2),
      item("Follow-ups", "/follow-ups", CalendarCheck, 2),
    ],
  },
  {
    label: "Delivery",
    items: [
      item("Services & packages", "/catalog/services", Package, 3),
      item("Blueprints", "/blueprints", FileStack, 3),
      item("Projects", "/projects", FolderKanban, 4),
      item("Approvals", "/approvals", CheckSquare, 4),
    ],
  },
  {
    label: "Operations",
    items: [
      item("Routines", "/routines", Repeat, 5),
      item("Diagnostics", "/diagnostics", Stethoscope, 5),
      item("Issues", "/issues", TriangleAlert, 5),
      item("Invoices", "/invoices", Receipt, 5),
      item("Reports", "/reports", BarChart3, 5),
    ],
  },
  {
    label: "Agents",
    items: [item("Work queue", "/agents/queue", Bot, 6)],
  },
  {
    label: "Administration",
    items: [item("Settings", "/settings/workspace", Settings, 1)],
  },
];

export const SETTINGS_TABS = [
  { label: "Workspace", href: "/settings/workspace", icon: ClipboardList, permission: null },
  { label: "Members", href: "/settings/members", icon: Users, permission: null },
  {
    label: "Pipeline",
    href: "/settings/pipeline",
    icon: ListChecks,
    permission: "pipeline.configure",
  },
  { label: "Security", href: "/settings/security", icon: ListChecks, permission: null },
  { label: "Audit log", href: "/settings/audit", icon: ListChecks, permission: "audit.read" },
] as const;
