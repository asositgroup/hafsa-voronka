import { Hono, type Context } from "hono";
import { adminReportQuerySchema } from "@funnel/shared";
import { requireAdminAuth } from "@/admin/auth";
import { resolveDateRange } from "@/admin/dates";
import { getReport } from "@/reports/queries";
import { buildReportWorkbook } from "@/reports/xlsx";

export const adminReportRoutes = new Hono();

adminReportRoutes.use("*", requireAdminAuth);

function parseRange(c: Context) {
  const query = adminReportQuerySchema.safeParse(c.req.query());
  if (!query.success) return null;
  return resolveDateRange(query.data.from, query.data.to);
}

adminReportRoutes.get("/", async (c) => {
  const range = parseRange(c);
  if (!range) return c.json({ error: "invalid_query" }, 400);
  return c.json(await getReport(range));
});

adminReportRoutes.get("/export.xlsx", async (c) => {
  const range = parseRange(c);
  if (!range) return c.json({ error: "invalid_query" }, 400);
  const buffer = await buildReportWorkbook(await getReport(range));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="hisobot-${range.from}-${range.to}.xlsx"`,
      "cache-control": "no-store",
    },
  });
});
