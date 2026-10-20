"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { adminMe } from "@/lib/admin/api";

export function useAdminSession() {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;
    void adminMe().then((isLoggedIn) => {
      if (!active) return;
      if (isLoggedIn) setAuthorized(true);
      else router.replace("/admin/login");
    });
    return () => {
      active = false;
    };
  }, [router, pathname]);

  return authorized;
}
