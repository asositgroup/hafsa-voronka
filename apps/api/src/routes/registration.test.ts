import { describe, expect, it } from "vitest";
import { uz } from "@/i18n/uz";
import { validateRegistration } from "./registration";

const unverified = { phone: null, phoneVerified: false };

describe("validateRegistration", () => {
  it("accepts a valid name and manual phone", () => {
    expect(validateRegistration({ name: "  Ali  ", phone: "90 123 45 67" }, unverified)).toEqual({
      ok: true,
      name: "Ali",
      phone: "+998901234567",
      phoneVerified: false,
    });
  });

  it("rejects short, long and missing names", () => {
    const nameError = { ok: false, field: "name", message: uz.validation.nameRequired };
    expect(validateRegistration({ name: "A", phone: "901234567" }, unverified)).toEqual(nameError);
    expect(validateRegistration({ name: "A".repeat(61), phone: "901234567" }, unverified)).toEqual(nameError);
    expect(validateRegistration({ phone: "901234567" }, unverified)).toEqual(nameError);
    expect(validateRegistration(null, unverified)).toEqual(nameError);
  });

  it("requires a valid phone when none is verified", () => {
    const phoneError = { ok: false, field: "phone", message: uz.validation.phoneRequired };
    expect(validateRegistration({ name: "Ali" }, unverified)).toEqual(phoneError);
    expect(validateRegistration({ name: "Ali", phone: "+998 12 345 67 89" }, unverified)).toEqual(phoneError);
    expect(validateRegistration({ name: "Ali", phone: 901234567 }, unverified)).toEqual(phoneError);
  });

  it("keeps the verified contact phone and ignores the submitted one", () => {
    const verified = { phone: "+79161234567", phoneVerified: true };
    expect(validateRegistration({ name: "Ali", phone: "901234567" }, verified)).toEqual({
      ok: true,
      name: "Ali",
      phone: "+79161234567",
      phoneVerified: true,
    });
  });
});
