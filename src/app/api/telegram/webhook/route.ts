import { webhookCallback } from "grammy";
import { bot } from "@/lib/telegram-bot";

// Standart 10s'dan uzunroq — video yuklab berish (YouTube/Instagram), sayt
// tahlili va rasm generatsiya (/img) kabi amallar ba'zan undan ko'proq vaqt
// oladi.
export const maxDuration = 60;

// MUHIM: `export const maxDuration` faqat Vercel funksiya vaqtini
// belgilaydi — grammy'ning o'zining `webhookCallback()`i ICHKI ravishda
// ALOHIDA, standart 10 soniyalik timeout qo'yadi (onTimeout: "throw"),
// bu Vercel'ning maxDuration'iga umuman aloqasi yo'q. Shu sabab jonli
// sinovda "Request timed out after 10000 ms" -> 500 xatosi maxDuration=60
// qo'yilganidan keyin ham davom etardi. `timeoutMilliseconds: Infinity`
// grammy'ning o'z ichki timeout o'ramini butunlay o'chirib, yagona haqiqiy
// chegara sifatida yuqoridagi maxDuration'ni qoldiradi.
const handleUpdate = webhookCallback(bot, "std/http", {
  timeoutMilliseconds: Infinity,
});

export async function POST(req: Request) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  return handleUpdate(req);
}
