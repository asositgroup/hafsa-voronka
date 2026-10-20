import { type AdminVideoItem, formatMmSs, markRange, type VideoMarks } from "@funnel/shared";
import { type Api, InlineKeyboard } from "grammy";
import { type VideoMarkField, videoMarkFields } from "@/db/schema";
import { uz } from "@/i18n/uz";
import { checklistText, errorText, rangeHint } from "./checklist";
import { findAdminVideo, listAdminVideos, type VideoFailure } from "@/videos/adminService";

export const PAGE_SIZE = 8;
const TITLE_LIMIT = 40;

export const OPTIONAL_MARKS: readonly VideoMarkField[] = ["introEndSec", "unlockSec"];

const texts = uz.bot.videoLibrary;

export type View = { text: string; keyboard: InlineKeyboard };

function shortTitle(title: string) {
  return title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT - 1)}…` : title;
}

function timeOrEmpty(sec: number | null) {
  return sec === null ? texts.empty : formatMmSs(sec);
}

export function failureText(failure: VideoFailure) {
  const text = texts.failures[failure.code];
  return failure.code === "video_in_use" ? text.replace("{count}", String(failure.userCount)) : text;
}

function statusOf(item: AdminVideoItem) {
  if (item.isActive) return texts.status.active;
  return item.archivedAt ? texts.status.archived : texts.status.inactive;
}

export async function listView(page: number, notice?: string): Promise<View> {
  const items = await listAdminVideos();
  const keyboard = new InlineKeyboard();
  if (items.length === 0) return { text: withNotice(texts.listEmpty, notice), keyboard };

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  for (const item of items.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)) {
    const marker = item.isActive ? `${texts.activeMark} ` : item.archivedAt ? `${texts.archivedMark} ` : "";
    keyboard.text(`${marker}${shortTitle(item.title)} · ${formatMmSs(item.duration)}`, `vl:show:${item.id}`).row();
  }
  if (pageCount > 1) {
    if (current > 0) keyboard.text(texts.prevPage, `vl:list:${current - 1}`);
    if (current < pageCount - 1) keyboard.text(texts.nextPage, `vl:list:${current + 1}`);
  }

  const title = texts.listTitle.replace("{count}", String(items.length));
  return { text: withNotice(title, notice), keyboard };
}

function withNotice(text: string, notice?: string) {
  return notice ? `${notice}\n\n${text}` : text;
}

export function cardView(item: AdminVideoItem, notice?: string): View {
  const text = texts.card
    .replace("{title}", item.title)
    .replace("{status}", statusOf(item))
    .replace("{duration}", formatMmSs(item.duration))
    .replace("{intro}", timeOrEmpty(item.introEndSec))
    .replace("{course}", timeOrEmpty(item.courseStartSec))
    .replace("{price}", timeOrEmpty(item.priceSec))
    .replace("{unlock}", timeOrEmpty(item.unlockSec))
    .replace("{users}", String(item.userCount))
    .replace(
      "{short}",
      item.shortOfferVideoUrl
        ? texts.shortPresent.replace("{duration}", timeOrEmpty(item.shortOfferDuration))
        : texts.shortMissing,
    );

  const keyboard = new InlineKeyboard();
  if (!item.isActive && !item.archivedAt) keyboard.text(texts.activate, `vl:act:${item.id}`).row();
  keyboard.text(texts.editMarks, `vl:marks:${item.id}`).row();
  keyboard.text(item.shortOfferVideoUrl ? texts.replaceShort : texts.uploadShort, `vl:short:${item.id}`).row();
  if (item.shortOfferVideoUrl) keyboard.text(texts.removeShort, `vl:shortdel:${item.id}`).row();
  if (!item.isActive) {
    keyboard
      .text(item.archivedAt ? texts.unarchive : texts.archive, `vl:${item.archivedAt ? "unarch" : "arch"}:${item.id}`)
      .row();
    keyboard.text(texts.delete, `vl:del:${item.id}`).row();
  }
  keyboard.text(texts.back, "vl:list:0");
  return { text: withNotice(text, notice), keyboard };
}

export function deleteConfirmView(item: AdminVideoItem): View {
  return {
    text: texts.confirmDelete.replace("{title}", item.title),
    keyboard: new InlineKeyboard().text(texts.yes, `vl:delyes:${item.id}`).text(texts.no, `vl:show:${item.id}`),
  };
}

export function marksView(item: AdminVideoItem): View {
  const keyboard = new InlineKeyboard();
  for (const field of videoMarkFields) {
    const label = texts.markButton
      .replace("{label}", texts.markLabels[field])
      .replace("{value}", timeOrEmpty(item[field]));
    keyboard.text(label, `vl:mark:${item.id}:${field}`).row();
  }
  keyboard.text(texts.back, `vl:show:${item.id}`);
  return { text: texts.marksTitle.replace("{title}", item.title), keyboard };
}

export function cancelKeyboard(videoId: number) {
  return new InlineKeyboard().text(texts.cancel, `vl:cancel:${videoId}`);
}

function pickMarks(item: AdminVideoItem): VideoMarks {
  return {
    introEndSec: item.introEndSec,
    courseStartSec: item.courseStartSec,
    priceSec: item.priceSec,
    unlockSec: item.unlockSec,
  };
}

export function otherMarksOf(item: AdminVideoItem, field: VideoMarkField): VideoMarks {
  return { ...pickMarks(item), [field]: null };
}

export function markRangeOf(item: AdminVideoItem, field: VideoMarkField) {
  return markRange(field, otherMarksOf(item, field), item.duration);
}

export function markPromptView(item: AdminVideoItem, field: VideoMarkField, error?: string): View {
  const keyboard = new InlineKeyboard();
  if (OPTIONAL_MARKS.includes(field) && item[field] !== null) keyboard.text(texts.clearMark, `vl:clear:${item.id}`);
  keyboard.text(texts.cancel, `vl:cancel:${item.id}`);
  const checklist = checklistText(item.duration, pickMarks(item), (key) => (key === field ? "current" : "done"));
  const question = texts.askMark
    .replace("{title}", item.title)
    .replace("{checklist}", checklist)
    .replace("{label}", texts.markLabels[field]);
  const hint = rangeHint(field, markRangeOf(item, field), otherMarksOf(item, field), item.duration, "other");
  const text = `${question}\n${hint}`;
  return { text: error ? `${errorText(error)}\n\n${text}` : text, keyboard };
}

export async function sendCard(api: Api, chatId: number, videoId: number, notice?: string) {
  const item = await findAdminVideo(videoId);
  const view = item ? cardView(item, notice) : await listView(0, texts.failures.not_found);
  await api.sendMessage(chatId, view.text, { reply_markup: view.keyboard });
}
