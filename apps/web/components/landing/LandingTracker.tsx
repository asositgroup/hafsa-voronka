"use client";

import { useEffect } from "react";
import { trackLandingView } from "@/lib/tracking/client";

export function LandingTracker() {
  useEffect(() => {
    trackLandingView();
  }, []);

  return null;
}
