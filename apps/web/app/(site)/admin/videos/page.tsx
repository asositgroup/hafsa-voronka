"use client";

import { useEffect, useState } from "react";
import type { AdminVideoItem } from "@funnel/shared";
import { AdminNav } from "@/components/admin/AdminNav";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { VideoCard } from "@/components/admin/VideoCard";
import { VideoUploadForm } from "@/components/admin/VideoUploadForm";
import { fetchVideos } from "@/lib/admin/videos";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos;

export default function AdminVideosPage() {
  const authorized = useAdminSession();
  const [items, setItems] = useState<AdminVideoItem[] | null>(null);
  const [uploadsEnabled, setUploadsEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    void fetchVideos().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setItems(result.items);
      setUploadsEnabled(result.uploadsEnabled);
    });
    return () => {
      active = false;
    };
  }, [authorized]);

  const onResult = (next: AdminVideoItem[], enabled: boolean) => {
    setItems(next);
    setUploadsEnabled(enabled);
  };

  return (
    <div className="min-h-screen bg-varaq text-siyoh">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <AdminNav />

        <div>
          <h1 className="m-0 text-[28px] font-bold leading-tight text-siyoh">{copy.title}</h1>
          <p className="m-0 mt-1 text-sm text-qalam">{copy.subtitle}</p>
        </div>

        <SettingsCard />

        {failed && <p className="m-0 text-sm text-anor">{adminUz.common.error}</p>}
        {!items && !failed && <p className="m-0 py-20 text-center text-sm text-qalam">{adminUz.common.loading}</p>}

        {items && (
          <>
            {uploadsEnabled ? (
              <VideoUploadForm onItems={onResult} />
            ) : (
              <p className="m-0 rounded-[12px] bg-white/60 px-4 py-3 text-xs text-qalam">{copy.uploadsDisabled}</p>
            )}

            {items.length === 0 && <p className="m-0 py-10 text-center text-sm text-qalam">{copy.empty}</p>}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {items.map((item) => (
                <VideoCard key={item.id} item={item} uploadsEnabled={uploadsEnabled} onItems={onResult} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
