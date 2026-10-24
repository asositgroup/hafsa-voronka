import { Hono } from "hono";
import { activeVideo } from "@/videos/service";

export const landingRoutes = new Hono();

landingRoutes.get("/video", async (c) => {
  const video = await activeVideo();
  if (!video) return c.json({ error: "no_video" }, 404);
  c.header("cache-control", "public, max-age=300");
  return c.json({ duration: video.duration });
});
