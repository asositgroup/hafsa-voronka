"use client";

import { useEffect, useState } from "react";
import type { BotTextItem, BotTextKey } from "@funnel/shared";
import { BotTextCard } from "@/components/admin/BotTextCard";
import { Notice } from "@/components/admin/ui/Notice";
import { Page, PageHeader } from "@/components/admin/ui/Page";
import { ErrorState, LoadingState } from "@/components/admin/ui/States";
import { fetchBotTexts } from "@/lib/admin/botTexts";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.botTexts;

const groups: { title: string; keys: BotTextKey[] }[] = [
  { title: copy.groups.registration, keys: ["askContact", "askContactShort", "registered", "watchPrompt"] },
  { title: copy.groups.returning, keys: ["welcome", "welcomeBack", "fallback"] },
  { title: copy.groups.afterLesson, keys: ["completion"] },
  { title: copy.groups.buttons, keys: ["shareContactButton", "watchButton", "channelButton"] },
];

export default function AdminBotTextsPage() {
  const [items, setItems] = useState<BotTextItem[] | null>(null);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchBotTexts().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setItems(result.items);
      setMediaEnabled(Boolean(result.mediaEnabled));
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const byKey = new Map(items?.map((item) => [item.key, item]));

  const retry = () => {
    setFailed(false);
    setAttempt((value) => value + 1);
  };

  return (
    <Page width="narrow">
      <PageHeader title={adminUz.pages.botTexts.title} description={adminUz.pages.botTexts.description} />

      {items && !mediaEnabled && <Notice tone="info">{copy.mediaDisabled}</Notice>}

      {failed && <ErrorState onRetry={retry} />}
      {!items && !failed && <LoadingState variant="list" rows={3} />}

      {items &&
        groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-3">
            <h2 className="m-0 text-[17px] font-semibold text-siyoh">{group.title}</h2>
            <div className="flex flex-col gap-3">
              {group.keys.map((key) => {
                const item = byKey.get(key);
                return item ? <BotTextCard key={key} item={item} mediaEnabled={mediaEnabled} onItems={setItems} /> : null;
              })}
            </div>
          </section>
        ))}
    </Page>
  );
}
