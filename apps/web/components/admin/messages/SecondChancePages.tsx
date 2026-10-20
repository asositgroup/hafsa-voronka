"use client";

import {
  buttonPresets,
  type MessageTemplate,
  offerVariantOf,
  type OfferVariant,
  offerVariantStatuses,
  plainTextPreview,
  renderPlainText,
  SAMPLE_CONTEXT,
  SECOND_CHANCE_OCCASIONS,
  variableValues,
} from "@funnel/shared";
import type { MessagePreset } from "@/components/admin/messages/MessageEditor";
import { Button } from "@/components/admin/ui/Button";
import { Switch } from "@/components/admin/ui/Switch";
import { PlusIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.secondChance;
const sampleValues = variableValues(SAMPLE_CONTEXT);
const occasions = Array.from({ length: SECOND_CHANCE_OCCASIONS }, (_, index) => index + 1);

export function secondChancePreset(occasion: number, variant: OfferVariant): MessagePreset {
  return {
    day: occasion,
    text: copy.presets[variant],
    timing: { type: "occasion", value: 0 },
    statuses: [...offerVariantStatuses[variant]],
    buttons: [
      { kind: "again", text: buttonPresets.again },
      { kind: "later", text: buttonPresets.later },
    ],
  };
}

export function secondChancePage(items: MessageTemplate[], occasion: number, variant: OfferVariant) {
  return items.find((item) => item.day === occasion && offerVariantOf(item.statuses) === variant);
}

export function filledOccasions(items: MessageTemplate[]) {
  return occasions.filter((occasion) => secondChancePage(items, occasion, "not_opened")).length;
}

type SecondChancePagesProps = {
  items: MessageTemplate[];
  onEdit: (item: MessageTemplate) => void;
  onAdd: (preset: MessagePreset) => void;
  onToggle: (item: MessageTemplate, isActive: boolean) => void;
};

export function SecondChancePages({ items, onEdit, onAdd, onToggle }: SecondChancePagesProps) {
  function slot(occasion: number, kind: OfferVariant) {
    const page = secondChancePage(items, occasion, kind);
    const secondary = kind === "no_price";
    if (!page) {
      return secondary ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-1">
          <span className="text-[13px] font-semibold text-siyoh">{copy.slots[kind]}</span>
          <Button
            variant="ghost"
            size="sm"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => onAdd(secondChancePreset(occasion, kind))}
            className="-ml-3"
          >
            {copy.addVariant}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onAdd(secondChancePreset(occasion, kind))}
          className="flex min-h-11 w-full items-start gap-3 rounded-[10px] border border-dashed border-chiziq px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
        >
          <PlusIcon className="mt-0.5 h-4 w-4 shrink-0 text-qalam" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-siyoh">{copy.slots[kind]}</span>
            <span className="text-sm text-qalam">{copy.add}</span>
          </span>
        </button>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(page)}
          aria-label={`${copy.slots[kind]}: ${adminUz.messages.edit}`}
          className={`flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-[10px] py-1 pl-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh ${page.isActive ? "" : "opacity-60"}`}
        >
          <span className="text-[13px] font-semibold text-siyoh">{copy.slots[kind]}</span>
          <span className={`${secondary ? "line-clamp-1 text-[13px] text-qalam" : "line-clamp-2 text-sm text-siyoh"}`}>
            {renderPlainText(plainTextPreview(page.text, 140), sampleValues)}
          </span>
        </button>
        <Switch
          checked={page.isActive}
          onChange={(isActive) => onToggle(page, isActive)}
          label={page.isActive ? adminUz.messages.active : adminUz.messages.inactive}
        />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="m-0 text-[13px] text-qalam">{copy.hint}</p>
      <ol className="m-0 flex list-none flex-col divide-y divide-chiziq rounded-[16px] bg-white p-0">
        {occasions.map((occasion) => (
          <li key={occasion} aria-labelledby={`occasion-${occasion}`} className="flex flex-col gap-2 px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-0.5 pl-1">
              <h2 id={`occasion-${occasion}`} className="m-0 text-[15px] font-semibold text-siyoh">
                {copy.occasion.replace("{n}", String(occasion))}
              </h2>
              <p className="m-0 text-xs text-qalam">{occasion === 1 ? copy.firstWhen : copy.nextWhen}</p>
            </div>
            {slot(occasion, "not_opened")}
            {slot(occasion, "no_price")}
          </li>
        ))}
      </ol>
    </section>
  );
}
