import { Hono } from "hono";

export const trackRoutes = new Hono();

trackRoutes.post("/", (c) => c.json({ error: "not_implemented" }, 501));
