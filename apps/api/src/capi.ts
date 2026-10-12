import type { User } from "@/db/schema";

export type CapiEventName = "CompleteRegistration" | "VideoComplete";

export type CapiEvent = {
  name: CapiEventName;
  eventId: string;
  user: User;
};

export async function sendCapiEvent(event: CapiEvent): Promise<void> {
  void event;
}
