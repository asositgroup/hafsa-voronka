"use client";

import { useEffect, useState } from "react";
import type { BotTextItem, BotTextKey } from "@funnel/shared";
import { BotChat } from "@/components/admin/bot/BotChat";
import { BotTextEditor } from "@/components/admin/bot/BotTextEditor";
import { type ScenarioId, scenarioOrder } from "@/components/admin/bot/scenarios";
import { Notice } from "@/components/admin/ui/Notice";
import { Page, PageHeader } from "@/components/admin/ui/Page";
import { Segmented } from "@/components/admin/ui/Segmented";
import { ErrorState, LoadingState } from "@/components/admin/ui/States";
import { fetchBotTexts } from "@/lib/admin/botTexts";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.botTexts;

export default function AdminBotTextsPage() {
  const [items, setItems] = useState<BotTextItem[] | null>(null);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [scenario, setScenario] = useState<ScenarioId>("newUser");
  const [editing, setEditing] = useState<BotTextKey | null>(null);

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

  const editingItem = items?.find((item) => item.key === editing) ?? null;

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

      {items && (
        <div className="flex flex-col gap-4">
          <div className="mx-auto w-full max-w-[640px]">
            <Segmented
              label={copy.tabsLabel}
              role="tablist"
              fill
              value={scenario}
              onChange={setScenario}
              items={scenarioOrder.map((id) => ({ value: id, label: copy.tabs[id] }))}
            />
          </div>
          <BotChat
            key={scenario}
            scenario={scenario}
            items={items}
            onEditMessage={setEditing}
            onEditButton={setEditing}
          />
        </div>
      )}

      {editingItem && (
        <BotTextEditor
          key={editingItem.key}
          item={editingItem}
          mediaEnabled={mediaEnabled}
          onItems={setItems}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}
