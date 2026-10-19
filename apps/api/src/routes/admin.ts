import { Hono } from "hono";
import {
  adminLeadsQuerySchema,
  adminLoginRequestSchema,
  adminStatsQuerySchema,
} from "@funnel/shared";
import {
  clearAdminSessionCookie,
  getAdminPasswordHash,
  requireAdminAuth,
  requireAdminConfig,
  setAdminSessionCookie,
  verifyAdminSession,
  verifyPassword,
} from "@/admin/auth";
import { resolveDateRange } from "@/admin/dates";
import {
  getCampaignStats,
  getDailySeries,
  getFunnelAndKpis,
  getHealthStats,
  getLeads,
  getLeadsCsv,
  getWatchDropoff,
} from "@/admin/queries";
import { clientIp } from "@/http/clientIp";
import { consumeRateLimit } from "@/http/rateLimit";
import { adminBotTextRoutes } from "@/routes/adminBotTexts";
import { adminVideoRoutes } from "@/routes/adminVideos";
import { adminMessageRoutes } from "@/routes/adminMessages";
import { adminReportRoutes } from "@/routes/adminReports";
import { adminSettingsRoutes } from "@/routes/adminSettings";

export const adminRoutes = new Hono();

adminRoutes.use("*", requireAdminConfig);

adminRoutes.route("/bot-texts", adminBotTextRoutes);
adminRoutes.route("/videos", adminVideoRoutes);
adminRoutes.route("/messages", adminMessageRoutes);
adminRoutes.route("/reports", adminReportRoutes);
adminRoutes.route("/settings", adminSettingsRoutes);

adminRoutes.post("/login", async (c) => {
  const ip = clientIp(c);
  const allowed = await consumeRateLimit(`login:${ip}`, 5, 900);
  if (!allowed) {
    return c.json({ error: "rate_limited" }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = adminLoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const hash = getAdminPasswordHash();
  const valid = await verifyPassword(parsed.data.password, hash!);
  if (!valid) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = await setAdminSessionCookie(c);
  return c.json({ ok: true, token });
});

adminRoutes.post("/logout", (c) => {
  clearAdminSessionCookie(c);
  return c.json({ ok: true });
});

adminRoutes.get("/me", async (c) => {
  const valid = await verifyAdminSession(c);
  if (!valid) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return c.json({ ok: true });
});

adminRoutes.get("/stats", requireAdminAuth, async (c) => {
  const query = adminStatsQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const { from, to } = resolveDateRange(query.data.from, query.data.to);
  const filters = {
    from,
    to,
    source: query.data.source || undefined,
    campaign: query.data.campaign || undefined,
  };

  const [funnelAndKpis, daily, campaigns, dropoff, health] = await Promise.all([
    getFunnelAndKpis(filters),
    getDailySeries(filters),
    getCampaignStats(filters),
    getWatchDropoff(filters),
    getHealthStats(),
  ]);

  return c.json({
    from,
    to,
    kpis: funnelAndKpis.kpis,
    funnel: funnelAndKpis.funnel,
    daily,
    campaigns,
    dropoff,
    health,
  });
});

adminRoutes.get("/leads", requireAdminAuth, async (c) => {
  const query = adminLeadsQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const { from, to } = resolveDateRange(query.data.from, query.data.to);
  const filters = {
    from,
    to,
    source: query.data.source || undefined,
    campaign: query.data.campaign || undefined,
  };

  const result = await getLeads(filters, query.data.page, 50);
  return c.json(result);
});

adminRoutes.get("/leads.csv", requireAdminAuth, async (c) => {
  const query = adminStatsQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const { from, to } = resolveDateRange(query.data.from, query.data.to);
  const filters = {
    from,
    to,
    source: query.data.source || undefined,
    campaign: query.data.campaign || undefined,
  };

  const csv = await getLeadsCsv(filters);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${from}-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
});
