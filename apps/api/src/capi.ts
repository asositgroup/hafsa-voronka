import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, type User } from "@/db/schema";
import { env } from "@/env";

export const GRAPH_API_VERSION = "v26.0";

export type CapiEventName = "CompleteRegistration" | "VideoComplete";

export type CapiClient = {
  userAgent?: string;
  ip?: string;
};

export type CapiEvent = {
  name: CapiEventName;
  eventId: string;
  user: User;
  client?: CapiClient;
};

export type CapiUserData = {
  ph?: string;
  external_id: string;
  country: string;
  fbc?: string;
  client_user_agent?: string;
  client_ip_address?: string;
};

export type CapiEventItem = {
  event_name: CapiEventName;
  event_id: string;
  event_time: number;
  action_source: "website";
  event_source_url: string;
  user_data: CapiUserData;
};

export type CapiPayload = {
  data: CapiEventItem[];
  test_event_code?: string;
};

export type CapiContext = {
  webUrl?: string;
  testEventCode?: string;
  landingViewCreatedAt?: Date | null;
  eventTime?: number;
};

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildCapiPayload(event: CapiEvent, context: CapiContext = {}): CapiPayload {
  const digits = event.user.phone ? event.user.phone.replace(/\D/g, "") : "";
  const ph = digits ? hashString(digits) : undefined;
  const external_id = hashString(String(event.user.telegramId));
  const country = hashString("uz");

  const userData: CapiUserData = {
    external_id,
    country,
  };
  if (ph) {
    userData.ph = ph;
  }
  if (event.client?.userAgent) {
    userData.client_user_agent = event.client.userAgent;
  }
  if (event.client?.ip) {
    userData.client_ip_address = event.client.ip;
  }

  if (event.user.fbclid) {
    const fallbackDate = event.user.createdAt ?? new Date();
    const date = context.landingViewCreatedAt ?? fallbackDate;
    const ms = date.getTime();
    userData.fbc = `fb.1.${ms}.${event.user.fbclid}`;
  }

  const webUrl = context.webUrl ?? (process.env.WEB_URL ? env.WEB_URL : "https://example.com");
  const eventTime = context.eventTime ?? Math.floor(Date.now() / 1000);
  const testEventCode = context.testEventCode ?? (process.env.FB_TEST_EVENT_CODE ? env.FB_TEST_EVENT_CODE : undefined);

  const item: CapiEventItem = {
    event_name: event.name,
    event_id: event.eventId,
    event_time: eventTime,
    action_source: "website",
    event_source_url: webUrl,
    user_data: userData,
  };

  const payload: CapiPayload = {
    data: [item],
  };
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  return payload;
}

export async function sendCapiEvent(event: CapiEvent): Promise<void> {
  try {
    const pixelId = env.FB_PIXEL_ID;
    const token = env.FB_CAPI_TOKEN;
    if (!pixelId || !token) {
      return;
    }

    let landingViewCreatedAt: Date | null = null;
    if (event.user.visitorId) {
      try {
        const [earliestLanding] = await db()
          .select({ createdAt: events.createdAt })
          .from(events)
          .where(and(eq(events.visitorId, event.user.visitorId), eq(events.type, "landing_view")))
          .orderBy(asc(events.createdAt))
          .limit(1);
        landingViewCreatedAt = earliestLanding?.createdAt ?? null;
      } catch (dbError) {
        console.error("CAPI attribution lookup error:", dbError instanceof Error ? dbError.message : "DB error");
      }
    }

    const payload = buildCapiPayload(event, {
      landingViewCreatedAt,
      webUrl: env.WEB_URL,
      testEventCode: env.FB_TEST_EVENT_CODE,
    });

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const responseText = await res.text().catch(() => "");
      console.error(`CAPI request failed with status ${res.status}: ${responseText}`);
    }
  } catch (error) {
    console.error("CAPI send error:", error instanceof Error ? error.message : "Unknown error");
  }
}
