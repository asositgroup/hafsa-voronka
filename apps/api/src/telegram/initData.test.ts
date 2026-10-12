import { describe, expect, it } from "vitest";
import { signInitData, verifyInitData } from "./initData";

const BOT_TOKEN = "123456:TEST-token";
const NOW = 1_760_000_000;

function build(fields: Record<string, string>, token = BOT_TOKEN) {
  const params = new URLSearchParams(fields);
  params.set("hash", signInitData(params, token));
  return params.toString();
}

const user = JSON.stringify({ id: 42, first_name: "Ali", username: "ali", language_code: "uz" });

describe("verifyInitData", () => {
  it("accepts correctly signed data", () => {
    const raw = build({ auth_date: String(NOW - 60), query_id: "AAH", user });
    const result = verifyInitData(raw, BOT_TOKEN, NOW);
    expect(result).toEqual({
      ok: true,
      user: { id: 42, first_name: "Ali", username: "ali", language_code: "uz" },
      authDate: NOW - 60,
      startParam: undefined,
    });
  });

  it("exposes start_param", () => {
    const raw = build({ auth_date: String(NOW), user, start_param: "v_abc" });
    const result = verifyInitData(raw, BOT_TOKEN, NOW);
    expect(result.ok && result.startParam).toBe("v_abc");
  });

  it("rejects missing data", () => {
    expect(verifyInitData("", BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "missing" });
    expect(verifyInitData(null, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects data signed with another bot token", () => {
    const raw = build({ auth_date: String(NOW), user }, "999:other");
    expect(verifyInitData(raw, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("rejects tampered user", () => {
    const params = new URLSearchParams(build({ auth_date: String(NOW), user }));
    params.set("user", JSON.stringify({ id: 1, first_name: "Evil" }));
    expect(verifyInitData(params.toString(), BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("rejects a malformed hash without throwing", () => {
    const params = new URLSearchParams(build({ auth_date: String(NOW), user }));
    params.set("hash", "abc");
    expect(verifyInitData(params.toString(), BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("rejects data older than 24 hours", () => {
    const raw = build({ auth_date: String(NOW - 24 * 3600 - 1), user });
    expect(verifyInitData(raw, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects signed data without a user", () => {
    const raw = build({ auth_date: String(NOW) });
    expect(verifyInitData(raw, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "bad_user" });
  });
});
