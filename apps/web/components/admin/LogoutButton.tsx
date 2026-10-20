"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoutIcon } from "@/components/icons";
import { Button } from "@/components/admin/ui/Button";
import { adminLogout } from "@/lib/admin/api";
import { adminUz } from "@/lib/i18n/admin";

export function LogoutButton({ tone }: { tone: "sidebar" | "sheet" }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await adminLogout();
    router.push("/admin/login");
  };

  const label = loggingOut ? adminUz.dashboard.loggingOut : adminUz.nav.logout;

  if (tone === "sheet") {
    return (
      <Button variant="dangerGhost" block disabled={loggingOut} onClick={handleLogout} icon={<LogoutIcon className="h-5 w-5" />}>
        {label}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-kumush transition-colors hover:bg-varaq/5 hover:text-varaq focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oltin disabled:opacity-50"
    >
      <LogoutIcon className="h-5 w-5" />
      {label}
    </button>
  );
}
