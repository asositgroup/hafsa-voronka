import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { env } from "@/env";

const scryptAsync = promisify(scrypt);
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const COOKIE_NAME = "admin_session";

export function signToken(value: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${sig}`;
}

export function verifyToken(token: string, secret: string): string | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;
  const val = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  if (!val || !sig) return null;
  const expectedSig = createHmac("sha256", secret).update(val).digest("base64url");
  if (sig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  return val;
}

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

  // 1. Authorization header: Bearer <token>
  const authHeader = c.req.header("Authorization") || c.req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const expiryStr = verifyToken(token, secret);
    if (expiryStr) {
      const expiry = Number(expiryStr);
      if (!Number.isNaN(expiry) && expiry > Date.now()) {
        return true;
      }
    }
  }

  // 2. Custom header: X-Admin-Session
  const customHeader = c.req.header("x-admin-session");
  if (customHeader) {
    const expiryStr = verifyToken(customHeader.trim(), secret);
    if (expiryStr) {
      const expiry = Number(expiryStr);
      if (!Number.isNaN(expiry) && expiry > Date.now()) {
        return true;
      }
    }
  }

  // 3. Query parameter ?token= (useful for direct downloads like CSV)
  const queryToken = c.req.query("token");
  if (queryToken) {
    const expiryStr = verifyToken(queryToken.trim(), secret);
    if (expiryStr) {
      const expiry = Number(expiryStr);
      if (!Number.isNaN(expiry) && expiry > Date.now()) {
        return true;
      }
    }
  }

  // 4. Fallback to signed cookie
  const sessionVal = await getSignedCookie(c, secret, COOKIE_NAME);
  if (typeof sessionVal === "string" && sessionVal) {
    const expiry = Number(sessionVal);
    if (!Number.isNaN(expiry) && expiry > Date.now()) {
      return true;
    }
  }
  return false;
}

export const requireAdminAuth: MiddlewareHandler = async (c, next) => {
  const valid = await verifyAdminSession(c);
  if (!valid) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return next();
};

export async function setAdminSessionCookie(c: Context): Promise<string> {
  const secret = getSessionSecret();
  const expiryMs = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const isHttps = env.API_URL.startsWith("https");

  await setSignedCookie(c, COOKIE_NAME, String(expiryMs), secret!, {
    httpOnly: true,
    sameSite: isHttps ? "None" : "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: isHttps,
  });

  return signToken(String(expiryMs), secret!);
}

export function clearAdminSessionCookie(c: Context): void {
  const isHttps = env.API_URL.startsWith("https");
  deleteCookie(c, COOKIE_NAME, {
    path: "/",
    secure: isHttps,
    sameSite: isHttps ? "None" : "Lax",
  });
}
