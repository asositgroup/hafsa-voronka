import type { Video } from "@/db/schema";

export function effectiveUnlockSec(video: Pick<Video, "unlockSec" | "priceSec"> | null | undefined) {
  return video?.unlockSec ?? video?.priceSec ?? null;
}
