import type { InlineKeyboardMarkup } from "grammy/types";
import {
  escapeHtml,
  renderPlainText,
  renderText,
  sanitizeTelegramHtml,
  type TemplateButton,
  type TemplateContext,
  type TemplateMedia,
  variableValues,
} from "@funnel/shared";
import { env } from "@/env";
import { watchAppUrl } from "@/telegram/watchUrl";

export type TemplateContent = {
  text: string;
  media: TemplateMedia | null;
  buttons: TemplateButton[];
};

export type ButtonWrap = {
  url(url: string, index: number): string;
  webApp(url: string, index: number): string;
};

export type RenderedMessage = {
  text: string;
  parse_mode: "HTML";
  reply_markup?: InlineKeyboardMarkup;
  media: TemplateMedia | null;
};

export function adminChatUrl(prefill: string | undefined, values: Record<string, string>) {
  const url = new URL(env.CHANNEL_URL);
  if (prefill) url.searchParams.set("text", renderPlainText(prefill, values));
  return url.toString();
}

function renderButton(
  button: TemplateButton,
  index: number,
  ref: string,
  values: Record<string, string>,
  wrap: ButtonWrap | undefined,
) {
  switch (button.kind) {
    case "resume":
    case "offer":
    case "again": {
      const url = watchAppUrl(button.kind);
      return { text: button.text, web_app: { url: wrap ? wrap.webApp(url, index) : url } };
    }
    case "admin": {
      const url = adminChatUrl(button.prefill, values);
      return { text: button.text, url: wrap ? wrap.url(url, index) : url };
    }
    case "link":
      return { text: button.text, url: wrap ? wrap.url(button.url, index) : button.url };
    case "later":
      return { text: button.text, callback_data: `mt:l:${ref}` };
    case "dismiss":
      return { text: button.text, callback_data: `mt:d:${ref}` };
  }
}

export function renderTemplate(
  template: TemplateContent,
  ctx: TemplateContext,
  opts: { ref: string; wrap?: ButtonWrap },
): RenderedMessage {
  const values = variableValues(ctx);
  const sanitized = sanitizeTelegramHtml(template.text);
  const rendered: RenderedMessage = {
    text: renderText(sanitized.ok ? sanitized.html : escapeHtml(template.text), values),
    parse_mode: "HTML",
    media: template.media,
  };
  if (template.buttons.length > 0) {
    rendered.reply_markup = {
      inline_keyboard: template.buttons.map((button, index) => [
        renderButton(button, index, opts.ref, values, opts.wrap),
      ]),
    };
  }
  return rendered;
}
