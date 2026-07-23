// Telegram Bot API bilan to'g'ridan-to'g'ri fetch orqali ishlash (grammy'siz)
// — /telegram sahifasida dinamik qo'shiladigan botlar uchun. Bitta doimiy
// grammy Bot obyekti o'rniga har bir bot token bilan oddiy HTTP so'rovlar
// yuboriladi, chunki botlar soni va shakli runtime'da o'zgaradi (gemini.ts va
// google-calendar.ts dagi kabi paket bog'liqligini kamaytirish yondashuvi).

const TG_BASE = "https://api.telegram.org/bot";

async function callTelegramApi<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${TG_BASE}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram API xatosi (${method}): ${data.description ?? res.status}`);
  }
  return data.result as T;
}

export type TelegramBotInfo = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
};

export function getMe(token: string): Promise<TelegramBotInfo> {
  return callTelegramApi<TelegramBotInfo>(token, "getMe");
}

export function sendMessage(token: string, chatId: number | bigint, text: string): Promise<unknown> {
  return callTelegramApi(token, "sendMessage", { chat_id: chatId.toString(), text });
}

export function sendChatAction(token: string, chatId: number | bigint, action: string): Promise<unknown> {
  return callTelegramApi(token, "sendChatAction", { chat_id: chatId.toString(), action });
}

// `allowedUpdates` berilmasa, Telegram standart to'plamni yuboradi. Business
// yangilanishlari (business_connection, business_message va h.k.) shu
// standart to'plamga kirmasligi mumkin — shuning uchun helperizim_bot uchun
// har doim aniq ro'yxat bilan chaqiriladi (telegram-bot.ts).
export function setWebhook(
  token: string,
  url: string,
  secretToken: string,
  allowedUpdates?: string[]
): Promise<unknown> {
  return callTelegramApi(token, "setWebhook", {
    url,
    secret_token: secretToken,
    ...(allowedUpdates ? { allowed_updates: allowedUpdates } : {}),
  });
}

export function deleteWebhook(token: string): Promise<unknown> {
  return callTelegramApi(token, "deleteWebhook");
}

export type TelegramWebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
};

export function getWebhookInfo(token: string): Promise<TelegramWebhookInfo> {
  return callTelegramApi<TelegramWebhookInfo>(token, "getWebhookInfo");
}

// Mini-app'ni ochish uchun bot chatining doimiy menyu tugmasi. `chatId`
// berilmasa, sozlama barcha xususiy chatlar uchun standart bo'ladi.
export function setChatMenuButton(
  token: string,
  webAppUrl: string,
  text: string,
  chatId?: number | bigint
): Promise<unknown> {
  return callTelegramApi(token, "setChatMenuButton", {
    ...(chatId !== undefined ? { chat_id: chatId.toString() } : {}),
    menu_button: {
      type: "web_app",
      text,
      web_app: { url: webAppUrl },
    },
  });
}
