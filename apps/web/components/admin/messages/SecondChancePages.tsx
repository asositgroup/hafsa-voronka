"use client";

import {
  buttonPresets,
  type MessageTemplate,
  offerVariantOf,
  type OfferVariant,
  offerVariants,
  offerVariantStatuses,
  plainTextPreview,
  renderPlainText,
  SAMPLE_CONTEXT,
  SECOND_CHANCE_OCCASIONS,
  variableValues,
} from "@funnel/shared";
import type { MessagePreset } from "@/components/admin/messages/MessageEditor";
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

type SecondChancePagesProps = {
  items: MessageTemplate[];
  onEdit: (item: MessageTemplate) => void;
  onAdd: (preset: MessagePreset) => void;
  onToggle: (item: MessageTemplate, isActive: boolean) => void;
};

export function SecondChancePages({ items, onEdit, onAdd, onToggle }: SecondChancePagesProps) {
  const pageFor = (occasion: number, variant: OfferVariant) =>
    items.find((item) => item.day === occasion && offerVariantOf(item.statuses) === variant);

  return (
    <section className="flex flex-col gap-4">
      <p className="m-0 text-[13px] text-qalam">{copy.hint}</p>
      {occasions.map((occasion) => (
        <section key={occasion} aria-labelledby={`occasion-${occasion}`} className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5 px-1">
            <h2 id={`occasion-${occasion}`} className="m-0 text-sm font-semibold text-siyoh">
              {copy.occasion.replace("{n}", String(occasion))}
            </h2>
            <p className="m-0 text-xs text-qalam">{occasion === 1 ? copy.firstWhen : copy.nextWhen}</p>
          </div>
          <ul className="m-0 flex list-none flex-col divide-y divide-chiziq rounded-[16px] bg-white p-0">
            {offerVariants.map((variant) => {
              const page = pageFor(occasion, variant);
              return (
                <li key={variant} className="flex items-center gap-1 px-2 py-2 sm:px-3">
                  {page ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(page)}
                        aria-label={`${copy.slots[variant]}: ${adminUz.messages.edit}`}
                        className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-[10px] py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
                      >
                        <span className={`text-[13px] font-semibold text-siyoh ${page.isActive ? "" : "opacity-60"}`}>
                          {copy.slots[variant]}
                        </span>
                        <span className={`line-clamp-2 text-sm text-siyoh ${page.isActive ? "" : "opacity-60"}`}>
                          {renderPlainText(plainTextPreview(page.text, 140), sampleValues)}
                        </span>
                      </button>
                      <Switch
                        checked={page.isActive}
                        onChange={(isActive) => onToggle(page, isActive)}
                        label={page.isActive ? adminUz.messages.active : adminUz.messages.inactive}
                      />
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAdd(secondChancePreset(occasion, variant))}
                      className="flex min-h-11 w-full items-start gap-3 rounded-[10px] border border-dashed border-chiziq px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
                    >
                      <PlusIcon className="mt-0.5 h-4 w-4 shrink-0 text-qalam" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-semibold text-siyoh">
                          {copy.slots[variant]} · {copy.add}
                        </span>
                        <span className="text-[13px] text-qalam">{copy.empty}</span>
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
