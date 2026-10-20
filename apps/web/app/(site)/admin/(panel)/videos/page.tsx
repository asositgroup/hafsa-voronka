"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AdminVideoItem } from "@funnel/shared";
import { VideoDriveImportForm } from "@/components/admin/VideoDriveImportForm";
import { VideoCard } from "@/components/admin/VideoCard";
import { VideoUploadForm } from "@/components/admin/VideoUploadForm";
import { Button } from "@/components/admin/ui/Button";
import { Notice } from "@/components/admin/ui/Notice";
import { Page, PageHeader } from "@/components/admin/ui/Page";
import { Segmented } from "@/components/admin/ui/Segmented";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/ui/States";
import { PlusIcon } from "@/components/icons";
import { fetchVideos } from "@/lib/admin/videos";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos;

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-[17px] font-semibold text-siyoh">{title}</h2>
        {description && <p className="m-0 mt-0.5 text-[13px] text-qalam">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function AdminVideosPage() {
  const [items, setItems] = useState<AdminVideoItem[] | null>(null);
  const [uploadsEnabled, setUploadsEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [source, setSource] = useState<"file" | "drive">("file");

  useEffect(() => {
    let active = true;
    void fetchVideos().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setItems(result.items);
      setUploadsEnabled(result.uploadsEnabled);
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const onResult = (next: AdminVideoItem[], enabled: boolean) => {
    setItems(next);
    setUploadsEnabled(enabled);
  };

  const onUploaded = (next: AdminVideoItem[], enabled: boolean) => {
    onResult(next, enabled);
    setUploadOpen(false);
  };

  const retry = () => {
    setFailed(false);
    setAttempt((value) => value + 1);
  };

  const activeItems = items?.filter((item) => item.isActive) ?? [];
  const otherItems = items?.filter((item) => !item.isActive && item.archivedAt === null) ?? [];
  const archivedItems = items?.filter((item) => !item.isActive && item.archivedAt !== null) ?? [];

  const card = (item: AdminVideoItem) => <VideoCard key={item.id} item={item} uploadsEnabled={uploadsEnabled} onItems={onResult} />;

  return (
    <Page>
      <PageHeader
        title={adminUz.pages.videos.title}
        description={adminUz.pages.videos.description}
        actions={
          items && uploadsEnabled ? (
            <Button
              variant={uploadOpen ? "secondary" : "primary"}
              aria-expanded={uploadOpen}
              icon={uploadOpen ? undefined : <PlusIcon className="h-4 w-4" />}
              onClick={() => setUploadOpen((open) => !open)}
            >
              {uploadOpen ? copy.upload.cancel : copy.uploadAction}
            </Button>
          ) : undefined
        }
      />

      {failed && <ErrorState onRetry={retry} />}
      {!items && !failed && <LoadingState variant="list" rows={2} />}

      {items && (
        <>
          {!uploadsEnabled && <Notice tone="info">{copy.uploadsDisabled}</Notice>}

          {uploadsEnabled && uploadOpen && (
            <div className="flex flex-col gap-3">
              <Segmented
                role="tablist"
                label={copy.sources.label}
                value={source}
                onChange={setSource}
                items={[
                  { value: "file", label: copy.sources.file },
                  { value: "drive", label: copy.sources.drive },
                ]}
              />
              <div hidden={source !== "file"}>
                <VideoUploadForm onItems={onUploaded} />
              </div>
              <div hidden={source !== "drive"}>
                <VideoDriveImportForm onItems={onUploaded} />
              </div>
            </div>
          )}

          {items.length === 0 && !uploadOpen && (
            <EmptyState
              title={copy.emptyTitle}
              description={copy.emptyHint}
              action={
                uploadsEnabled ? (
                  <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
                    {copy.uploadAction}
                  </Button>
                ) : undefined
              }
            />
          )}

          {activeItems.length > 0 && (
            <Group title={copy.groups.active} description={copy.activeHint}>
              <div className="flex flex-col gap-3">{activeItems.map(card)}</div>
            </Group>
          )}

          {otherItems.length > 0 && (
            <Group title={copy.groups.others}>
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">{otherItems.map(card)}</div>
            </Group>
          )}

          {archivedItems.length > 0 && (
            <details className="group flex flex-col gap-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-[17px] font-semibold text-siyoh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh">
                {copy.groups.archive} ({archivedItems.length})
              </summary>
              <div className="mt-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-2">{archivedItems.map(card)}</div>
            </details>
          )}
        </>
      )}
    </Page>
  );
}
