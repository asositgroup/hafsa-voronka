import { Bot } from "grammy";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  const apiUrl = required("API_URL").replace(/\/$/, "");
  const webUrl = required("WEB_URL").replace(/\/$/, "");
  const bot = new Bot(required("BOT_TOKEN"), { client: { apiRoot: process.env.BOT_API_ROOT || undefined } });

  const webhookUrl = (process.env.BOT_API_ROOT && process.env.BOT_WEBHOOK_URL) || `${apiUrl}/bot`;

  await bot.api.setWebhook(webhookUrl, {
    secret_token: required("WEBHOOK_SECRET"),
    allowed_updates: ["message", "my_chat_member", "callback_query"],
    drop_pending_updates: true,
  });

  await bot.api.setChatMenuButton({
    menu_button: { type: "web_app", text: "Video", web_app: { url: `${webUrl}/app` } },
  });

  const info = await bot.api.getWebhookInfo();
  console.log(`Webhook set: ${info.url} (pending ${info.pending_update_count})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
