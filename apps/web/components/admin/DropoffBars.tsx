import type { DropoffStat } from "@funnel/shared";
import { FlowFunnel } from "@/components/admin/FlowFunnel";
import { adminUz } from "@/lib/i18n/admin";

export function DropoffBars({ dropoff }: { dropoff: DropoffStat[] }) {
  return (
    <FlowFunnel
      title={adminUz.dropoff.title}
      subtitle={adminUz.dropoff.subtitle}
      stages={dropoff.map((item) => ({
        key: String(item.minute),
        label: adminUz.dropoff.minuteLabel(item.minute),
        count: item.count,
      }))}
    />
  );
}
