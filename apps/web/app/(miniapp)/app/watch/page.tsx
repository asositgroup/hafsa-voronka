"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen, useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { LinkExpiredScreen } from "@/components/watch/LinkExpiredScreen";
import { OfferFirstScreen } from "@/components/watch/OfferFirstScreen";
import { WatchScreen } from "@/components/watch/WatchScreen";

export default function WatchPage() {
  const router = useRouter();
  const { session } = useMiniApp();
  const [offerUrl] = useState(() => session.offerFirst?.url ?? null);
  const [offerDismissed, setOfferDismissed] = useState(false);

  useEffect(() => {
    if (!session.registered) router.replace("/app");
  }, [router, session.registered]);

  if (!session.registered) return <LoadingScreen />;
  if (session.expired) return <LinkExpiredScreen />;
  if (offerUrl !== null && !offerDismissed) {
    return <OfferFirstScreen url={offerUrl} onContinue={() => setOfferDismissed(true)} />;
  }
  return <WatchScreen />;
}
