import { LogoutButton } from "@/components/admin/LogoutButton";
import { MessageCapsCard } from "@/components/admin/MessageCapsCard";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { Page, PageHeader } from "@/components/admin/ui/Page";
import { adminUz } from "@/lib/i18n/admin";

export default function AdminSettingsPage() {
  return (
    <Page width="narrow">
      <PageHeader title={adminUz.pages.settings.title} description={adminUz.pages.settings.description} />
      <SettingsCard />
      <MessageCapsCard />
      <div className="lg:hidden">
        <LogoutButton tone="sheet" />
      </div>
    </Page>
  );
}
