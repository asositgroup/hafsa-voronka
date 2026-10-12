import { normalizeUzPhone, registerRequestSchema } from "@funnel/shared";
import { uz } from "@/i18n/uz";

type ExistingPhone = { phone: string | null; phoneVerified: boolean };

export type RegistrationResult =
  | { ok: true; name: string; phone: string; phoneVerified: boolean }
  | { ok: false; field: "name" | "phone"; message: string };

export function validateRegistration(body: unknown, existing: ExistingPhone): RegistrationResult {
  const parsed = registerRequestSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] === "phone" ? "phone" : "name";
    return {
      ok: false,
      field,
      message: field === "phone" ? uz.validation.phoneRequired : uz.validation.nameRequired,
    };
  }

  if (existing.phoneVerified && existing.phone) {
    return { ok: true, name: parsed.data.name, phone: existing.phone, phoneVerified: true };
  }

  const phone = normalizeUzPhone(parsed.data.phone ?? "");
  if (!phone) {
    return { ok: false, field: "phone", message: uz.validation.phoneRequired };
  }
  return { ok: true, name: parsed.data.name, phone, phoneVerified: false };
}
