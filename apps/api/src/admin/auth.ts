import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { env } from "@/env";

const scryptAsync = promisify(scrypt);
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const COOKIE_NAME = "admin_session";

export function getAdminPasswordHash(): string | undefined {
  return process.env.ADMIN_PASSWORD_HASH || env.ADMIN_PASSWORD_HASH;
}

export function getSessionSecret(): string | undefined {
  return process.env.SESSION_SECRET || env.SESSION_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = Buffer.from(parts[1], "base64");
  const expectedKey = Buffer.from(parts[2], "base64");
  if (salt.length !== 16 || expectedKey.length !== 64) {
    return false;
  }
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(derivedKey, expectedKey);
}

export const requireAdminConfig: MiddlewareHandler = async (c, next) => {
  const hash = getAdminPasswordHash();
  const secret = getSessionSecret();
  if (!hash || !secret || !process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) {
    return c.json({ error: "admin_disabled" }, 503);
  }
  return next();
};

export async function verifyAdminSession(c: Context): Promise<boolean> {
  const secret = getSessionSecret();
  if (!secret) {
    return false;
  }
  const sessionVal = await getSignedCookie(c, secret, COOKIE_NAME);
  if (typeof sessionVal !== "string" || !sessionVal) {
    return false;
  }
  const expiry = Number(sessionVal);
  if (Number.isNaN(expiry) || expiry <= Date.now()) {
    return false;
  }
  return true;
}

export const requireAdminAuth: MiddlewareHandler = async (c, next) => {
  const valid = await verifyAdminSession(c);
  if (!valid) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return next();
};

export async function setAdminSessionCookie(c: Context): Promise<void> {
  const secret = getSessionSecret();
  const expiryMs = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  await setSignedCookie(c, COOKIE_NAME, String(expiryMs), secret!, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/admin",
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: env.API_URL.startsWith("https"),
  });
}

export function clearAdminSessionCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAME, {
    path: "/admin",
    secure: env.API_URL.startsWith("https"),
  });
}
