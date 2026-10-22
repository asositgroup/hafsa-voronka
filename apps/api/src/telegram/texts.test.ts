import { describe, expect, it } from "vitest";
import { BOT_TEXT_LIMITS, botMediaTypeFor, validateBotText } from "@funnel/shared";

describe("validateBotText", () => {
  it("accepts a message using its allowed placeholder", () => {
    expect(validateBotText("welcome", "Salom, {name}!", false)).toBeNull();
  });

  it("rejects placeholders the message does not support", () => {
    expect(validateBotText("fallback", "Rahmat, {name}!", false)).toBe("unknown_placeholder");
    expect(validateBotText("welcome", "Salom, {phone}!", false)).toBe("unknown_placeholder");
  });

  it("rejects empty text", () => {
    expect(validateBotText("fallback", "   ", false)).toBe("empty");
  });

  it("uses the caption limit when the message has media", () => {
    const text = "a".repeat(BOT_TEXT_LIMITS.caption + 1);
    expect(validateBotText("welcome", text, false)).toBeNull();
    expect(validateBotText("welcome", text, true)).toBe("too_long");
  });

  it("accepts formatted messages and counts only visible characters", () => {
    expect(validateBotText("welcome", "<b>Salom</b>, <i>{name}</i>!", false)).toBeNull();
    const padded = `<b>${"a".repeat(BOT_TEXT_LIMITS.caption + 1)}</b>`;
    expect(validateBotText("fallback", padded, false)).toBeNull();
    expect(validateBotText("fallback", padded, true)).toBe("too_long");
  });

  it("rejects broken formatting in messages", () => {
    expect(validateBotText("fallback", "<b>Salom", false)).toBe("unbalanced_tag");
    expect(validateBotText("fallback", "<b><code>x</code></b>", false)).toBe("invalid_nesting");
    expect(validateBotText("fallback", '<a href="javascript:alert(1)">x</a>', false)).toBe("invalid_link");
  });

  it("treats button text as plain text", () => {
    expect(validateBotText("watchButton", "<b>Ko'rish", false)).toBeNull();
    expect(validateBotText("watchButton", "<b><code>x</code></b>", false)).toBeNull();
  });

  it("keeps buttons short and on one line", () => {
    expect(validateBotText("watchButton", "a".repeat(BOT_TEXT_LIMITS.button + 1), false)).toBe("too_long");
    expect(validateBotText("watchButton", "Ko'rish\nhozir", false)).toBe("multiline_button");
    expect(validateBotText("watchButton", "▶️ Ko'rish", false)).toBeNull();
  });
});

describe("botMediaTypeFor", () => {
  it("maps supported mime types and rejects the rest", () => {
    expect(botMediaTypeFor("image/png")).toBe("photo");
    expect(botMediaTypeFor("video/mp4")).toBe("video");
    expect(botMediaTypeFor("image/gif")).toBeNull();
  });
});
