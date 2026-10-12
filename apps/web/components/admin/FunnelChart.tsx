import type { FunnelStep } from "@funnel/shared";
import { FlowFunnel } from "@/components/admin/FlowFunnel";
import { adminUz } from "@/lib/i18n/admin";

export function FunnelChart({ funnel }: { funnel: FunnelStep[] }) {
  return (
    <FlowFunnel
      title={adminUz.funnel.title}
      subtitle={adminUz.funnel.subtitle}
      stages={funnel.map((step) => ({ key: step.step, label: step.name, count: step.count }))}
    />
  );
}
