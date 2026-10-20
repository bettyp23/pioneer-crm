import { cookies } from "next/headers";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

// Protected shell. Layouts are not an authorization boundary on their own (they may not
// re-render on client navigation), so every page and action also calls requireMember().
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { member } = await requireMember();
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        workspaceName={member.workspaceName}
        footer={
          <UserMenu
            displayName={member.displayName}
            email={member.email}
            roleLabel={ROLE_LABELS[member.role]}
          />
        }
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="text-sm font-medium">{member.workspaceName}</span>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
