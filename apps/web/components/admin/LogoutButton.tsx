"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoutIcon } from "@/components/icons";
import { adminLogout } from "@/lib/admin/api";
import { adminUz } from "@/lib/i18n/admin";

export function LogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await adminLogout();
    router.push("/admin/login");
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-qalam transition-colors hover:text-siyoh disabled:opacity-50"
    >
      <LogoutIcon className="h-4 w-4" />
      {loggingOut ? adminUz.dashboard.loggingOut : adminUz.dashboard.logoutButton}
    </button>
  );
}
