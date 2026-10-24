import { SETTINGS_TABS } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsTabs } from "@/components/layout/settings-tabs";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const { member } = await requireMember();
  const tabs = SETTINGS_TABS.filter(
    (tab) => tab.permission === null || can(member.role, tab.permission),
  ).map(({ label, href }) => ({ label, href }));

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs tabs={tabs} />
      {children}
    </>
  );
}
