import { CheckIcon } from "@/components/icons";
import { Badge } from "@/components/admin/ui/Badge";
import { adminUz } from "@/lib/i18n/admin";

export function SaveStatus({ state }: { state: "idle" | "dirty" | "saved" }) {
  if (state === "dirty") return <Badge tone="attention">{adminUz.botTexts.unsaved}</Badge>;
  if (state === "saved") {
    return (
      <span role="status" className="inline-flex items-center gap-1 text-[13px] font-medium text-zumrad">
        <CheckIcon className="h-4 w-4" />
        {adminUz.common.saved}
      </span>
    );
  }
  return null;
}
