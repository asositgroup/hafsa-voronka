import type { BotButtonKey, BotMessageKey } from "@funnel/shared";

export type ScenarioId = "newUser" | "returning" | "afterLesson" | "secondChance";

export type ChatButton = { key: BotButtonKey; placement: "reply" | "inline" };

export type ChatTrigger =
  | { kind: "user"; text: "start" | "wrote" | "contact" | "later"; context?: "notWatched" | "watched" }
  | { kind: "note" };

export type ScenarioCard = { key: BotMessageKey; trigger?: ChatTrigger; buttons: ChatButton[] };

const watch: ChatButton = { key: "watchButton", placement: "inline" };
const channel: ChatButton = { key: "channelButton", placement: "inline" };
const share: ChatButton = { key: "shareContactButton", placement: "reply" };

export const scenarioOrder: ScenarioId[] = ["newUser", "returning", "afterLesson", "secondChance"];

export const scenarios: Record<ScenarioId, ScenarioCard[]> = {
  newUser: [
    { key: "askContact", trigger: { kind: "user", text: "start" }, buttons: [share] },
    { key: "askContactShort", trigger: { kind: "user", text: "wrote" }, buttons: [share] },
    { key: "registered", trigger: { kind: "user", text: "contact" }, buttons: [] },
    { key: "watchPrompt", buttons: [watch] },
  ],
  returning: [
    { key: "welcome", trigger: { kind: "user", text: "start", context: "notWatched" }, buttons: [watch] },
    { key: "welcomeBack", trigger: { kind: "user", text: "start", context: "watched" }, buttons: [watch, channel] },
    { key: "fallback", trigger: { kind: "user", text: "wrote" }, buttons: [watch] },
  ],
  afterLesson: [{ key: "completion", trigger: { kind: "note" }, buttons: [channel] }],
  secondChance: [{ key: "laterAck", trigger: { kind: "user", text: "later" }, buttons: [] }],
};

export function buttonUsage(key: BotButtonKey) {
  return Object.values(scenarios)
    .flat()
    .filter((card) => card.buttons.some((button) => button.key === key)).length;
}
