"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminMe } from "@/lib/admin/api";

export function useAdminSession() {
  const router = useRouter();
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
  }, [router]);

  return authorized;
}
