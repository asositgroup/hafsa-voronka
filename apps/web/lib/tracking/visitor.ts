const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
export const VISITOR_COOKIE_NAME = "vid";

export function generateVisitorId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < 10; i++) {
    id += ALPHABET[bytes[i] & 63];
  }
  return id;
}

export function getVisitorIdCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE_NAME}=([A-Za-z0-9_-]{10})(?:;|$)`),
  );
  return match ? match[1] : null;
}

export function setVisitorIdCookie(visitorId: string): void {
  if (typeof document === "undefined") return;
  const maxAge = 30 * 24 * 60 * 60;
  document.cookie = `${VISITOR_COOKIE_NAME}=${visitorId}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export function getOrCreateVisitorId(): string {
  const existing = getVisitorIdCookie();
  if (existing) return existing;
  const created = generateVisitorId();
  setVisitorIdCookie(created);
  return created;
}
