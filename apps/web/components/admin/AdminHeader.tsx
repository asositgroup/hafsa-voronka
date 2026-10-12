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
    <header className="border-b border-chiziq bg-varaq sticky top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        <HealthBadges health={health} />

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-[10px] border border-chegara bg-white px-3 py-1.5 text-xs font-medium text-siyoh hover:bg-varaq transition disabled:opacity-50"
        >
          {loggingOut ? adminUz.dashboard.loggingOut : adminUz.dashboard.logoutButton}
        </button>
      </div>
    </header>
  );
}
