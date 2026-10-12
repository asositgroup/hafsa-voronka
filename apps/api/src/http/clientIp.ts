import type { Context } from "hono";

export function clientIp(c: Context) {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

export function capiClient(c: Context) {
  const ip = clientIp(c);
  return {
    userAgent: c.req.header("user-agent"),
    ip: ip === "unknown" ? undefined : ip,
  };
}
