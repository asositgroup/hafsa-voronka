"use client";

import { uz } from "@/lib/i18n/uz";

export default function WatchPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-3xl">
          🎬
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {uz.watch.title}
        </h1>
        <p className="text-sm text-zinc-400">{uz.watch.subtitle}</p>
      </div>
    </div>
  );
}
