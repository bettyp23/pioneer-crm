"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { NAV_ITEMS } from "./nav-items";

export function AppSidebar({
  workspaceName,
  footer,
}: {
  workspaceName: string;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-xs font-bold">
                  P
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold">Pioneer OS</span>
                  <span className="text-muted-foreground truncate text-xs">{workspaceName}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((navItem) => (
                <SidebarMenuItem key={navItem.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      navItem.href === "/dashboard"
                        ? pathname === navItem.href
                        : pathname.startsWith(navItem.href)
                    }
                    tooltip={navItem.label}
                  >
                    <Link href={navItem.href}>
                      <navItem.icon />
                      <span>{navItem.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
