"use client";

import { useEffect, useState } from "react";
import type { BotTextItem, BotTextKey } from "@funnel/shared";
import { AdminNav } from "@/components/admin/AdminNav";
import { BotTextCard } from "@/components/admin/BotTextCard";
import { fetchBotTexts } from "@/lib/admin/botTexts";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.botTexts;

const groups: { title: string; keys: BotTextKey[] }[] = [
  { title: copy.groups.registration, keys: ["askContact", "askContactShort", "registered", "watchPrompt"] },
  { title: copy.groups.returning, keys: ["welcome", "welcomeBack", "fallback"] },
  { title: copy.groups.afterLesson, keys: ["completion"] },
  { title: copy.groups.buttons, keys: ["shareContactButton", "watchButton", "channelButton"] },
];

export default function AdminBotTextsPage() {
  const authorized = useAdminSession();
  const [items, setItems] = useState<BotTextItem[] | null>(null);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    void fetchBotTexts().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setItems(result.items);
      setMediaEnabled(Boolean(result.mediaEnabled));
    });
    return () => {
      active = false;
    };
  }, [authorized]);

  const byKey = new Map(items?.map((item) => [item.key, item]));

  return (
    <div className="min-h-screen bg-varaq text-siyoh">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <AdminNav />

        <div>
          <h1 className="m-0 text-[28px] font-bold leading-tight text-siyoh">{copy.title}</h1>
          <p className="m-0 mt-1 text-sm text-qalam">{copy.subtitle}</p>
        </div>

        {items && (
          <p className="m-0 rounded-[12px] bg-white/60 px-4 py-3 text-xs text-qalam">
            {mediaEnabled ? copy.mediaHint : copy.mediaDisabled}
          </p>
        )}

        {failed && <p className="m-0 text-sm text-anor">{adminUz.common.error}</p>}
        {!items && !failed && <p className="m-0 py-20 text-center text-sm text-qalam">{adminUz.common.loading}</p>}

        {items &&
          groups.map((group) => (
            <section key={group.title} className="flex flex-col gap-3">
              <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-qalam">{group.title}</h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {group.keys.map((key) => {
                  const item = byKey.get(key);
                  return item ? (
                    <BotTextCard key={key} item={item} mediaEnabled={mediaEnabled} onItems={setItems} />
                  ) : null;
                })}
              </div>
            </section>
          ))}
      </main>
    </div>
  );
}
