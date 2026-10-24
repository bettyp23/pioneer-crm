"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { NAV_SECTIONS } from "./nav-items";

export function AppSidebar({
  workspaceName,
  footer,
}: {
  workspaceName: string;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href.startsWith("/settings") && pathname.startsWith("/settings"));

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
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((navItem) => (
                  <SidebarMenuItem key={navItem.href}>
                    {navItem.available ? (
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(navItem.href)}
                        tooltip={navItem.label}
                      >
                        <Link href={navItem.href}>
                          <navItem.icon />
                          <span>{navItem.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      <>
                        <SidebarMenuButton
                          aria-disabled
                          disabled
                          tooltip={`${navItem.label} — coming in M${navItem.milestone}`}
                        >
                          <navItem.icon />
                          <span>{navItem.label}</span>
                        </SidebarMenuButton>
                        <SidebarMenuBadge>M{navItem.milestone}</SidebarMenuBadge>
                      </>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
