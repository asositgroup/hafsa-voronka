"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen, useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { LinkExpiredScreen } from "@/components/watch/LinkExpiredScreen";
import { WatchScreen } from "@/components/watch/WatchScreen";

export default function WatchPage() {
  const router = useRouter();
  const { session } = useMiniApp();

  useEffect(() => {
    if (!session.registered) router.replace("/app");
  }, [router, session.registered]);

  if (!session.registered) return <LoadingScreen />;
  if (session.expired) return <LinkExpiredScreen />;
  return <WatchScreen />;
}
