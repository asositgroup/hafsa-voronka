import { type CapiActionSource, type CapiClient, sendCapiEvent } from "@/capi";
import type { User } from "@/db/schema";
import { env } from "@/env";
import { attachLeadToUser } from "@/leads/service";
import { enqueueLead, formatLeadRow, sendLeadInline } from "@/sheets";
import { logEvent, markRegistered } from "./users";

export type RegistrationFields = { name: string; phone: string; phoneVerified: boolean };

export type RegistrationSource = { actionSource: CapiActionSource; client?: CapiClient };

export async function completeRegistration(
  user: User,
  fields: RegistrationFields,
  source: RegistrationSource,
) {
  const registered = await markRegistered(user.id, fields);
  if (!registered) return undefined;

  await logEvent("registered", { userId: user.id, visitorId: user.visitorId });
  await attachLeadToUser(registered).catch((error) =>
    console.error("Lead attach failed:", error),
  );

  void sendCapiEvent({
    name: "CompleteRegistration",
    eventId: `reg_${user.id}`,
    user: registered,
    actionSource: source.actionSource,
    client: source.client,
  }).catch((error) => console.error("CAPI CompleteRegistration failed:", error));

  if (env.SHEETS_ENABLED) {
    void enqueueLead(user.id, formatLeadRow(registered))
      .then(sendLeadInline)
      .catch((error) => console.error("Sheets send error:", error));
  }

  return registered;
}

export function nameFromTelegram(profile: { first_name?: string; last_name?: string }) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim().slice(0, 60);
}
