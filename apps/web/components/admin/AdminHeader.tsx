"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HealthStat } from "@funnel/shared";
import { adminLogout } from "@/lib/admin/api";
import { adminUz } from "@/lib/i18n/admin";
import { HealthBadges } from "./HealthBadges";

export function AdminHeader({ health }: { health: HealthStat }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await adminLogout();
    router.push("/admin/login");
  };

  return (
    <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm">
            VF
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
            {adminUz.dashboard.title}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <HealthBadges health={health} />
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition disabled:opacity-50"
          >
            {loggingOut ? adminUz.dashboard.loggingOut : adminUz.dashboard.logoutButton}
          </button>
        </div>
      </div>
    </header>
  );
}
