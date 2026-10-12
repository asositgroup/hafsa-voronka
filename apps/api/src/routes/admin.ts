import { Hono } from "hono";

export const adminRoutes = new Hono();

adminRoutes.all("*", (c) => c.json({ error: "not_implemented" }, 501));
