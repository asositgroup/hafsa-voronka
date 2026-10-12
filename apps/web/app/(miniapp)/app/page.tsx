"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen, useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { RegistrationScreen } from "@/components/registration/RegistrationScreen";

export default function AppPage() {
  const router = useRouter();
  const { session } = useMiniApp();

  useEffect(() => {
    if (session.registered) router.replace("/app/watch");
  }, [router, session.registered]);

  if (session.registered) return <LoadingScreen />;
  return <RegistrationScreen />;
}
