import { webhookCallback } from "grammy";
import { bot } from "@/lib/telegram-bot";

const handleUpdate = webhookCallback(bot, "std/http");

export async function POST(req: Request) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  return handleUpdate(req);
}
