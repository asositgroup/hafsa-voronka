"use client";

import { type MessageTemplate, plainTextPreview, renderPlainText, SAMPLE_CONTEXT, variableValues } from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Section } from "@/components/admin/ui/Section";
import { Switch } from "@/components/admin/ui/Switch";
import { PencilIcon, PlusIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.nightNotice;
const sampleValues = variableValues(SAMPLE_CONTEXT);

type NightRulesProps = {
  notice: MessageTemplate | undefined;
  onCreate: () => void;
  onEdit: (item: MessageTemplate) => void;
  onToggle: (item: MessageTemplate, isActive: boolean) => void;
};

export function NightRules({ notice, onCreate, onEdit, onToggle }: NightRulesProps) {
  return (
    <Section title={copy.title} description={copy.rules}>
      <div className="flex flex-col gap-2 rounded-[12px] bg-varaq p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="m-0 text-sm font-semibold text-siyoh">{copy.noticeTitle}</h3>
            <p className="m-0 text-[13px] text-qalam">{copy.noticeHint}</p>
          </div>
          {notice ? (
            <Switch
              checked={notice.isActive}
              onChange={(isActive) => onToggle(notice, isActive)}
              label={`${copy.noticeTitle}: ${notice.isActive ? adminUz.messages.active : adminUz.messages.inactive}`}
            />
          ) : (
            <Button variant="secondary" size="sm" icon={<PlusIcon className="h-4 w-4" />} onClick={onCreate}>
              {copy.add}
            </Button>
          )}
        </div>
        {notice && (
          <div className="flex items-start gap-2">
            <p className={`m-0 line-clamp-2 min-w-0 flex-1 text-sm text-siyoh ${notice.isActive ? "" : "opacity-60"}`}>
              {renderPlainText(plainTextPreview(notice.text, 140), sampleValues)}
            </p>
            <Button variant="ghost" size="sm" icon={<PencilIcon className="h-4 w-4" />} onClick={() => onEdit(notice)}>
              {adminUz.messages.edit}
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}
