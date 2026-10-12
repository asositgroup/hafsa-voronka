import { Hono } from "hono";
import type { AppEnv } from "@/auth";

export const videoRoutes = new Hono<AppEnv>();

videoRoutes.post("/progress", (c) => c.json({ error: "not_implemented" }, 501));
videoRoutes.post("/event", (c) => c.json({ error: "not_implemented" }, 501));
