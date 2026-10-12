"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen, useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { BotRegisterScreen } from "@/components/registration/BotRegisterScreen";

export default function AppPage() {
  const router = useRouter();
  const { session } = useMiniApp();

  useEffect(() => {
    if (session.registered) router.replace("/app/watch");
  }, [router, session.registered]);

  if (session.registered) return <LoadingScreen />;
  return <BotRegisterScreen />;
}
