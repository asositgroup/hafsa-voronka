"use client";

import { useId } from "react";
import type { MessageTemplate } from "@funnel/shared";
import { PermanentBadge } from "@/components/admin/messages/MessageCard";
import { MessagePreview } from "@/components/admin/messages/MessagePreview";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { Switch } from "@/components/admin/ui/Switch";
import { LockIcon, PlusIcon } from "@/components/icons";
import { timingSummary } from "@/lib/admin/messageTiming";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;

type TriggerCardProps = {
  triggers: MessageTemplate[];
  onCreate: () => void;
  onEdit: (item: MessageTemplate) => void;
  onToggle: (item: MessageTemplate, isActive: boolean) => void;
};

export function TriggerCard({ triggers, onCreate, onEdit, onToggle }: TriggerCardProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-[16px] bg-white p-4 sm:p-5">
      <div>
        <h2 id={titleId} className="m-0 flex items-center gap-2 text-[17px] font-semibold leading-snug text-siyoh">
          <LockIcon className="h-5 w-5 text-qalam" />
          {copy.trigger.title}
        </h2>
        <p className="m-0 mt-0.5 text-[13px] text-qalam">{copy.trigger.subtitle}</p>
      </div>

      {triggers.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[12px] border border-dashed border-chegara/50 p-4">
          <p className="m-0 text-sm text-qalam">{copy.trigger.empty}</p>
          <Button icon={<PlusIcon className="h-4 w-4" />} onClick={onCreate}>
            {copy.trigger.create}
          </Button>
        </div>
      ) : (
        triggers.map((trigger) => (
          <article key={trigger.id} className="flex flex-col gap-3 rounded-[12px] border border-chiziq p-3">
            <div className="flex items-center gap-2">
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Badge tone={trigger.isActive ? "success" : "neutral"}>{timingSummary(trigger)}</Badge>
                {trigger.media && <Badge>{copy.mediaBadge[trigger.media.type]}</Badge>}
                {trigger.isPermanent && <PermanentBadge />}
              </span>
              <Switch
                checked={trigger.isActive}
                onChange={(isActive) => onToggle(trigger, isActive)}
                label={trigger.isActive ? copy.active : copy.inactive}
              />
            </div>
            <div className={trigger.isActive ? "" : "opacity-60"}>
              <MessagePreview text={trigger.text} buttons={trigger.buttons} />
            </div>
            <div>
              <Button variant="secondary" size="sm" onClick={() => onEdit(trigger)}>
                {copy.trigger.edit}
              </Button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
