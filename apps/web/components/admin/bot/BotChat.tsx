"use client";

import Image from "next/image";
import { useState } from "react";
import type { BotButtonKey, BotMessageKey, BotTextItem } from "@funnel/shared";
import { RichTextView } from "@/components/admin/messages/MessagePreview";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Section";
import {
  type ChatButton,
  type ChatTrigger,
  type ScenarioCard,
  scenarios,
  type ScenarioId,
} from "@/components/admin/bot/scenarios";
import { PencilIcon, PlayIcon } from "@/components/icons";
import { botMediaUrl } from "@/lib/admin/botTexts";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.botTexts;

const placeholderSamples = copy.placeholderLabels;

function isEdited(item: BotTextItem) {
  return item.text !== null || item.media !== null;
}

export function EditBadge({ item }: { item: BotTextItem }) {
  return isEdited(item) ? (
    <Badge tone="attention">{copy.edited}</Badge>
  ) : (
    <Badge>{copy.default}</Badge>
  );
}

export function MediaThumb({ item }: { item: BotTextItem }) {
  const [failed, setFailed] = useState(false);
  if (!item.media || failed) return null;

  return (
    <div className="relative -mx-3 -mt-2 mb-2 overflow-hidden rounded-t-[14px] bg-siyoh/90">
      {item.media.type === "photo" ? (
        <Image
          src={botMediaUrl(item)}
          alt=""
          width={600}
          height={340}
          unoptimized
          className="max-h-[200px] w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <video
            src={botMediaUrl(item)}
            preload="metadata"
            muted
            playsInline
            className="max-h-[200px] w-full object-cover"
            onError={() => setFailed(true)}
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-siyoh/60 text-white">
              <PlayIcon className="h-6 w-6" />
            </span>
          </span>
        </>
      )}
    </div>
  );
}

type ButtonChipProps = {
  button: ChatButton;
  item: BotTextItem;
  onEdit: (key: BotButtonKey) => void;
};

function ButtonChip({ button, item, onEdit }: ButtonChipProps) {
  const label = item.text ?? item.defaultText;
  const reply = button.placement === "reply";

  return (
    <button
      type="button"
      onClick={() => onEdit(button.key)}
      aria-label={`${copy.editButton}: ${label}`}
      className={`group relative flex min-h-10 items-center justify-center gap-2 px-8 py-2 text-center text-[14px] font-medium leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh ${
        reply
          ? "flex-1 basis-[140px] rounded-[8px] bg-white text-siyoh shadow-[0_1px_0_rgba(18,59,51,0.2)] hover:bg-white/80"
          : "w-full rounded-[10px] bg-siyoh/60 text-white hover:bg-siyoh/70"
      }`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <PencilIcon
        className={`absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 ${
          reply ? "text-qalam" : "text-white"
        }`}
      />
    </button>
  );
}

function BotBubble({
  item,
  inline,
  onEditMessage,
  onEditButton,
  byKey,
}: {
  item: BotTextItem;
  inline: ChatButton[];
  byKey: Map<string, BotTextItem>;
  onEditMessage: (key: BotMessageKey) => void;
  onEditButton: (key: BotButtonKey) => void;
}) {
  const { label } = copy.items[item.key as BotMessageKey];
  const text = item.text ?? item.defaultText;

  return (
    <div className="flex w-fit min-w-[40%] max-w-[88%] flex-col gap-1 self-start">
      <div className="group relative ml-1.5">
        <span
          aria-hidden="true"
          className="absolute -left-[7px] bottom-0 h-[12px] w-[8px] bg-white [clip-path:path('M8_0_V12_H0_C4_11_8_8_8_0_Z')]"
        />
        <div className="relative rounded-[14px] rounded-bl-[2px] bg-white px-3 pb-1.5 pt-2 text-[14px] leading-[1.45] text-siyoh shadow-[0_1px_1px_rgba(18,59,51,0.15)]">
          <MediaThumb item={item} />
          <div className="pointer-events-none flex flex-col gap-0.5 whitespace-pre-wrap break-words">
            <RichTextView text={text} samples={placeholderSamples} chips />
          </div>
          <p className="m-0 mt-0.5 text-right text-[11px] leading-none text-qalam">
            {copy.messageTime}
          </p>
          <button
            type="button"
            onClick={() => onEditMessage(item.key as BotMessageKey)}
            aria-label={`${copy.editMessage}: ${label}`}
            className="absolute inset-0 z-10 rounded-[14px] rounded-bl-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
          />
        </div>
      </div>
      {inline.length > 0 && (
        <div className="ml-1.5 flex flex-col gap-1">
          {inline.map(button => {
            const buttonItem = byKey.get(button.key);
            return buttonItem ? (
              <ButtonChip
                key={button.key}
                button={button}
                item={buttonItem}
                onEdit={onEditButton}
              />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

function TriggerBubble({ trigger }: { trigger: ChatTrigger }) {
  if (trigger.kind === "note") {
    return (
      <p className="m-0 self-center rounded-full bg-siyoh/15 px-3 py-1 text-center text-[12px] font-medium text-siyoh">
        {copy.notes[trigger.note ?? "buttonReady"]}
      </p>
    );
  }
  return (
    <div className="flex max-w-[80%] flex-col items-end gap-0.5 self-end">
      <div className="rounded-[14px] rounded-br-[2px] bg-[#e3f6c9] px-3 py-1.5 text-[14px] text-siyoh shadow-[0_1px_1px_rgba(18,59,51,0.15)]">
        {copy.user[trigger.text]}
      </div>
      {trigger.context && (
        <span className="pr-1 text-[12px] text-qalam">
          {copy.userContext[trigger.context]}
        </span>
      )}
    </div>
  );
}

type MessageCardProps = {
  card: ScenarioCard;
  byKey: Map<string, BotTextItem>;
  onEditMessage: (key: BotMessageKey) => void;
  onEditButton: (key: BotButtonKey) => void;
};

function MessageCard({
  card,
  byKey,
  onEditMessage,
  onEditButton,
}: MessageCardProps) {
  const item = byKey.get(card.key);
  if (!item) return null;
  const { label, when } = copy.items[card.key];
  const inline = card.buttons.filter(button => button.placement === "inline");
  const reply = card.buttons.filter(button => button.placement === "reply");

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <h2 className="m-0 text-[17px] font-semibold leading-snug text-siyoh">
            {label}
          </h2>
          <EditBadge item={item} />
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<PencilIcon className="h-4 w-4" />}
          onClick={() => onEditMessage(card.key)}
        >
          {copy.editCard}
        </Button>
      </div>
      <p className="m-0 text-[14px] text-qalam">
        <span className="font-medium text-siyoh">{copy.whenPrefix}</span> {when}
      </p>
      <div
        role="group"
        aria-label={copy.chatLabel}
        className="mx-auto flex w-full max-w-[420px] flex-col overflow-hidden rounded-[18px] bg-kumush/45"
      >
        <div className="flex flex-col gap-2.5 p-3">
          {card.trigger && <TriggerBubble trigger={card.trigger} />}
          <BotBubble
            item={item}
            inline={inline}
            byKey={byKey}
            onEditMessage={onEditMessage}
            onEditButton={onEditButton}
          />
        </div>
        {reply.length > 0 && (
          <div className="flex flex-col gap-1 bg-white/70 p-1.5">
            <div className="flex flex-wrap gap-1.5">
              {reply.map(button => {
                const buttonItem = byKey.get(button.key);
                return buttonItem ? (
                  <ButtonChip
                    key={button.key}
                    button={button}
                    item={buttonItem}
                    onEdit={onEditButton}
                  />
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

type BotChatProps = {
  scenario: ScenarioId;
  items: BotTextItem[];
  onEditMessage: (key: BotMessageKey) => void;
  onEditButton: (key: BotButtonKey) => void;
};

export function BotChat({
  scenario,
  items,
  onEditMessage,
  onEditButton,
}: BotChatProps) {
  const byKey = new Map(items.map(item => [item.key, item]));

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      {scenarios[scenario].map(card => (
        <MessageCard
          key={card.key}
          card={card}
          byKey={byKey}
          onEditMessage={onEditMessage}
          onEditButton={onEditButton}
        />
      ))}
    </div>
  );
}
