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
import { publicPath } from "@/lib/mount";

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
                {/* eslint-disable-next-line @next/next/no-img-element -- next/image does not add basePath */}
                <img
                  src={publicPath("/brand/pioneer-p-mark.png")}
                  alt=""
                  width={32}
                  height={23}
                  className="size-8 object-contain"
                />
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
