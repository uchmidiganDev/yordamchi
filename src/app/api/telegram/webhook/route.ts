import { webhookCallback } from "grammy";
import { bot } from "@/lib/telegram-bot";

// Standart 10s'dan uzunroq — video yuklab berish (YouTube/Instagram) va
// sayt tahlili kabi amallar ba'zan undan ko'proq vaqt oladi. 10s bilan
// jonli sinovda "Request timed out after 10000 ms" -> 500 xatosi kuzatildi.
export const maxDuration = 60;

const handleUpdate = webhookCallback(bot, "std/http");

export async function POST(req: Request) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  return handleUpdate(req);
}
